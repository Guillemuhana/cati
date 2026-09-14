-- ============================================================
-- CATI / NUMERA · Migración 36 · EL PAGO ACTIVA SOLO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   Desde que existen los links de suscripción, alguien puede pagar un
--   sábado a la noche. Mercado Pago cobra, pero en la app esa persona
--   sigue bloqueada hasta que un admin entre a /admin y le dé premium
--   a mano. Esta migración es la mitad de la base del webhook que lo
--   hace solo; la otra mitad es la Edge Function mp-webhook.
--
-- CÓMO SE SABE QUIÉN PAGÓ
--   El link del plan es el mismo para todos: no lleva escrito quién lo
--   abrió. Mercado Pago devuelve dos pistas y se usan en este orden:
--
--     1. external_reference — si el checkout se abrió con el id del
--        usuario colgado de la URL, viene acá y es exacto.
--     2. payer_email — el mail de la cuenta de Mercado Pago del que
--        pagó. Sirve seguido, pero NO siempre: mucha gente se registra
--        en la app con un mail y paga con la cuenta de Mercado Pago que
--        tiene a nombre de otro.
--
--   Cuando ninguna de las dos encuentra usuario, el pago NO se pierde:
--   queda en mp_eventos sin resolver, con el mail y el monto, para que
--   un admin lo active a mano. Es la diferencia entre «se cobró y no
--   sabemos de quién» y «se cobró y nadie se enteró».
--
-- LO QUE ESTA MIGRACIÓN NO HACE
--   No da de baja a nadie. Si alguien cancela, se le respeta el tiempo
--   que ya pagó: premium_until se vence solo cuando llega la fecha.
--   Cortar el servicio el día que cancela sería cobrarle un mes y
--   dárselo por la mitad.
-- ============================================================

-- ------------------------------------------------------------
-- 1) El libro de lo que manda Mercado Pago
--
--    Guarda TODAS las notificaciones, resueltas o no. Es el lugar
--    donde mirar cuando alguien dice «pagué y no me anda»: si el
--    evento está acá, el problema es nuestro; si no está, no llegó.
-- ------------------------------------------------------------
create table if not exists public.mp_eventos (
  id                bigint generated always as identity primary key,
  tipo              text        not null,           -- subscription_preapproval, etc.
  accion            text,                           -- created / updated
  recurso_id        text        not null,           -- data.id que mandó MP
  preapproval_id    text,
  plan_id           text,
  estado_mp         text,                           -- authorized, paused, cancelled…
  payer_email       text,
  external_ref      text,
  user_id           uuid        references auth.users(id) on delete set null,
  resuelto          boolean     not null default false,
  detalle           text,                           -- por qué no se resolvió, si aplica
  payload           jsonb,
  created_at        timestamptz not null default now()
);

-- Mercado Pago reintenta la misma notificación si no le contestamos
-- rápido. Sin esto, un reintento sumaría otro mes de premium por un
-- pago que ya se acreditó.
create unique index if not exists mp_eventos_unico
  on public.mp_eventos (tipo, recurso_id, coalesce(estado_mp, ''));

create index if not exists mp_eventos_sin_resolver
  on public.mp_eventos (created_at desc) where not resuelto;

alter table public.mp_eventos enable row level security;

-- Nadie lo lee con la clave del navegador. La Edge Function escribe
-- con service_role, que saltea RLS; los admins leen por la función de
-- abajo, que valida is_admin().
drop policy if exists mp_eventos_nadie on public.mp_eventos;
create policy mp_eventos_nadie on public.mp_eventos for all using (false);

-- ------------------------------------------------------------
-- 2) La activación
--
--    La llama la Edge Function con service_role DESPUÉS de haberle
--    preguntado a Mercado Pago por el recurso. Acá no se confía en lo
--    que llegó por internet: llegan datos ya verificados contra la API.
--
--    p_hasta es hasta cuándo queda pago. Viene de next_payment_date
--    más unos días de gracia, así una demora en el débito no deja a
--    nadie afuera el mismo día.
-- ------------------------------------------------------------
create or replace function public.mp_aplicar_suscripcion(
  p_tipo           text,
  p_accion         text,
  p_recurso_id     text,
  p_preapproval_id text,
  p_plan_id        text,
  p_estado         text,
  p_payer_email    text,
  p_external_ref   text,
  p_hasta          timestamptz,
  p_payload        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid;
  v_resuelto boolean := false;
  v_detalle  text;
  v_hasta    timestamptz;
begin
  -- 1) Quién es. Primero el id exacto, después el mail.
  if p_external_ref is not null and p_external_ref ~ '^[0-9a-f-]{36}$' then
    select id into v_user from auth.users where id = p_external_ref::uuid;
    if v_user is null then
      v_detalle := 'external_reference no corresponde a ningún usuario';
    end if;
  end if;

  if v_user is null and coalesce(p_payer_email, '') <> '' then
    select id into v_user from auth.users where lower(email) = lower(btrim(p_payer_email));
    if v_user is null then
      v_detalle := 'ningún usuario tiene el mail ' || p_payer_email;
    end if;
  end if;

  if v_user is null and v_detalle is null then
    v_detalle := 'la notificación no trajo ni external_reference ni payer_email';
  end if;

  -- 2) Si es un alta o un cobro aprobado, se le da el premium.
  if v_user is not null then
    if p_estado in ('authorized', 'approved', 'accredited') then
      -- Nunca se acorta lo que ya tenía: si le quedaba tiempo de una
      -- activación a mano, ese tiempo se respeta.
      v_hasta := greatest(
        coalesce(p_hasta, now() + interval '1 month'),
        coalesce((select premium_until from public.profiles where id = v_user), now())
      );

      update public.profiles
         set plan          = 'premium',
             premium_since = coalesce(premium_since, now()),
             premium_until = v_hasta
       where id = v_user;

      v_resuelto := true;
      v_detalle  := 'premium hasta ' || to_char(v_hasta, 'YYYY-MM-DD');
    else
      -- Cancelada o pausada: se anota y NO se toca el premium. Se
      -- vence solo cuando llega la fecha que ya estaba paga.
      v_resuelto := true;
      v_detalle  := 'suscripción en estado ' || coalesce(p_estado, '?') || ': no se toca el premium vigente';
    end if;
  end if;

  insert into public.mp_eventos (
    tipo, accion, recurso_id, preapproval_id, plan_id, estado_mp,
    payer_email, external_ref, user_id, resuelto, detalle, payload
  )
  values (
    p_tipo, p_accion, p_recurso_id, p_preapproval_id, p_plan_id, p_estado,
    p_payer_email, p_external_ref, v_user, v_resuelto, v_detalle, p_payload
  )
  on conflict (tipo, recurso_id, coalesce(estado_mp, '')) do nothing;

  return jsonb_build_object(
    'user_id',  v_user,
    'resuelto', v_resuelto,
    'detalle',  v_detalle
  );
end;
$$;

-- Solo el servidor. Con la clave del navegador esto no se puede llamar
-- ni sabiendo el nombre: sería regalarse premium.
revoke execute on function public.mp_aplicar_suscripcion(
  text, text, text, text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) Para mirarlo desde /admin
-- ------------------------------------------------------------
create or replace function public.admin_mp_eventos(p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  return coalesce(
    (
      select jsonb_agg(to_jsonb(e) order by e.created_at desc)
      from (
        select id, tipo, accion, estado_mp, payer_email, user_id,
               resuelto, detalle, created_at
        from public.mp_eventos
        order by created_at desc
        limit least(greatest(coalesce(p_limit, 50), 1), 200)
      ) e
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.admin_mp_eventos(int) from public, anon;
grant execute on function public.admin_mp_eventos(int) to authenticated;

-- ------------------------------------------------------------
-- 4) Verificación
--    a) La tabla y las funciones existen:
--         select to_regclass('public.mp_eventos');
--         select proname from pg_proc
--          where proname in ('mp_aplicar_suscripcion', 'admin_mp_eventos');
--
--    b) Un usuario cualquiera NO puede activarse premium solo:
--         select public.mp_aplicar_suscripcion(
--           'subscription_preapproval','created','1','1','1','authorized',
--           'el-mail-de-cualquiera@test.com', null, now() + interval '1 month', '{}'::jsonb
--         );
--       → tiene que FALLAR por permisos.
--
--    c) Después del primer pago de prueba:
--         select * from public.mp_eventos order by created_at desc limit 5;
-- ============================================================
-- Fin de la migración 36
-- ============================================================
