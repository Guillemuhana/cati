-- ============================================================
-- CATI / NUMERA · Migración 12 · PANEL DE ADMINISTRADOR
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos.
--
-- ⚠ REQUIERE las migraciones 10 y 11 corridas antes (usa la tabla
--   referrals y la función free_until()). Si las salteás, esta falla
--   con "relation does not exist" y no se aplica nada.
--
-- QUÉ HACE
--   Habilita la pantalla /admin para el dueño de la app: cuántos
--   usuarios hay, quiénes pagan, cuánto se factura, cómo vienen las
--   invitaciones, y activar/cancelar suscripciones a mano.
--
-- ⚠ POR QUÉ EL ADMIN SE IDENTIFICA POR user_id Y NO POR EMAIL
--   Lo natural sería preguntar auth.jwt()->>'email' = 'guillemuhana@…'.
--   No se hace: un usuario puede pedir un cambio de email desde la
--   propia app. Si algún día quedara mal configurado el "secure email
--   change" en Supabase, alguien podría apropiarse de esa dirección y
--   con ella del panel entero. El uuid de una cuenta, en cambio, no
--   cambia nunca y no se puede reclamar.
--
--   Los datos de TODOS los usuarios pasan por acá. Es la superficie más
--   sensible de la app: si esto se rompe, se filtra la base completa.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Quién es administrador
--    Tabla sin NINGUNA política RLS: con RLS activo y cero políticas,
--    PostgREST no devuelve ni una fila a nadie. Ni siquiera se puede
--    averiguar quiénes son los admins.
-- ------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- El dueño de la app. Si el email no existe todavía (cuenta sin crear),
-- esta línea no hace nada: registrate primero y volvé a correrla.
insert into public.admins (user_id, note)
select id, 'dueño'
  from auth.users
 where lower(email) = lower('guillemuhana@gmail.com')
on conflict (user_id) do nothing;

-- Para sumar otro admin más adelante (desde el SQL Editor, nunca desde la app):
--   insert into public.admins (user_id, note)
--   select id, 'socio' from auth.users where lower(email) = lower('otro@mail.com');


create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;


-- ------------------------------------------------------------
-- 2) Auditoría: toda acción de admin queda registrada
--    Si algún día algo raro pasa con una suscripción, acá está quién,
--    qué y cuándo. También sirve como historial de cobros mientras el
--    alta de premium sea manual.
-- ------------------------------------------------------------
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  target_id uuid,
  target_email text,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;

create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);


-- ------------------------------------------------------------
-- 3) Números generales del negocio
--    Los montos van SEPARADOS POR MONEDA a propósito: sumar pesos con
--    dólares da un número que no significa nada.
-- ------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  res jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select jsonb_build_object(
    'generado_en', now(),

    'usuarios', (
      select jsonb_build_object(
        'total',            count(*),
        'hoy',              count(*) filter (where u.created_at >= date_trunc('day', now())),
        'ultimos_7',        count(*) filter (where u.created_at >= now() - interval '7 days'),
        'ultimos_30',       count(*) filter (where u.created_at >= now() - interval '30 days'),
        'sin_confirmar',    count(*) filter (where u.email_confirmed_at is null),
        'activos_7',        count(*) filter (where u.last_sign_in_at >= now() - interval '7 days'),
        'activos_30',       count(*) filter (where u.last_sign_in_at >= now() - interval '30 days'),
        'nunca_entraron',   count(*) filter (where u.last_sign_in_at is null)
      )
      from auth.users u
    ),

    'planes', (
      select jsonb_build_object(
        'pagos',      count(*) filter (
                        where p.plan = 'premium'
                          and (p.premium_until is null or p.premium_until > now())
                      ),
        'en_prueba',  count(*) filter (
                        where coalesce(p.plan, 'free') <> 'premium'
                          and p.trial_ends_at > now()
                      ),
        'vencidos',   count(*) filter (
                        where coalesce(p.plan, 'free') <> 'premium'
                          and (p.trial_ends_at is null or p.trial_ends_at <= now())
                      ),
        'vencen_30',  count(*) filter (
                        where p.plan = 'premium'
                          and p.premium_until between now() and now() + interval '30 days'
                      ),
        'por_referido', count(*) filter (where p.referral_bonus_at is not null)
      )
      from public.profiles p
    ),

    -- Etapa promocional: hasta free_until() nadie paga, así que el
    -- ingreso real es 0 aunque haya cuentas marcadas como premium.
    'promo', jsonb_build_object(
      'gratis_hasta', public.free_until(),
      'vigente',      now() < public.free_until(),
      'dias_restantes', greatest(0, ceil(extract(epoch from (public.free_until() - now())) / 86400))
    ),

    'presupuestos', (
      select jsonb_build_object(
        'total',       count(*),
        'ultimos_30',  count(*) filter (where b.created_at >= now() - interval '30 days'),
        'aceptados',   count(*) filter (where b.status = 'aceptado'),
        'rechazados',  count(*) filter (where b.status = 'rechazado'),
        'enviados',    count(*) filter (where b.status in ('enviado', 'visto')),
        'borradores',  count(*) filter (where b.status = 'borrador')
      )
      from public.budgets b
    ),

    'montos_por_moneda', coalesce((
      select jsonb_agg(x order by x->>'moneda')
      from (
        select jsonb_build_object(
          'moneda',   b.currency,
          'emitido',  round(sum(b.total)::numeric, 2),
          'aceptado', round(sum(b.total) filter (where b.status = 'aceptado')::numeric, 2),
          'cantidad', count(*)
        ) as x
        from public.budgets b
        group by b.currency
      ) t
    ), '[]'::jsonb),

    'contenido', jsonb_build_object(
      'clientes',  (select count(*) from public.clients),
      'productos', (select count(*) from public.products),
      'facturas',  (select count(*) from public.invoices)
    ),

    'invitaciones', (
      select jsonb_build_object(
        'total',        count(*),
        'confirmadas',  count(*) filter (where r.status = 'confirmado'),
        'pendientes',   count(*) filter (where r.status = 'pendiente'),
        'premios',      (select count(*) from public.profiles where referral_bonus_at is not null)
      )
      from public.referrals r
    ),

    -- Altas por día de las últimas 4 semanas, para ver la tendencia.
    'altas_por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'altas', d.altas) order by d.dia)
      from (
        select date_trunc('day', u.created_at)::date as dia, count(*) as altas
          from auth.users u
         where u.created_at >= now() - interval '28 days'
         group by 1
      ) d
    ), '[]'::jsonb)
  ) into res;

  return res;
end;
$$;

revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;


-- ------------------------------------------------------------
-- 4) Listado de usuarios, con búsqueda y paginado
--    Devuelve email completo: es información del negocio del dueño,
--    no de terceros ajenos. Por eso este RPC es el más delicado de la
--    app y por eso arranca con el chequeo de admin.
-- ------------------------------------------------------------
create or replace function public.admin_users(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  res jsonb;
  total int;
  q text;
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  q := nullif(btrim(coalesce(p_search, '')), '');

  select count(*) into total
    from auth.users u
    left join public.profiles p on p.id = u.id
   where q is null
      or u.email ilike '%' || q || '%'
      or p.business_name ilike '%' || q || '%'
      or p.referral_code = upper(q);

  select jsonb_build_object(
    'total', total,
    'limit', lim,
    'offset', off,
    'usuarios', coalesce(jsonb_agg(fila order by (fila->>'created_at') desc), '[]'::jsonb)
  ) into res
  from (
    select jsonb_build_object(
      'id',                u.id,
      'email',             u.email,
      'business_name',     p.business_name,
      'created_at',        u.created_at,
      'last_sign_in_at',   u.last_sign_in_at,
      'email_confirmado',  u.email_confirmed_at is not null,
      'plan',              coalesce(p.plan, 'free'),
      'trial_ends_at',     p.trial_ends_at,
      'premium_until',     p.premium_until,
      'es_premium',        (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now())),
      'en_prueba',         (coalesce(p.plan,'free') <> 'premium' and p.trial_ends_at > now()),
      'referral_code',     p.referral_code,
      'referidos',         coalesce(p.referrals_count, 0),
      'premio_referidos',  p.referral_bonus_at,
      'invitado_por',      (select u2.email from auth.users u2 where u2.id = p.referred_by),
      'presupuestos',      (select count(*) from public.budgets b  where b.user_id = u.id),
      'clientes',          (select count(*) from public.clients c  where c.user_id = u.id),
      'facturas',          (select count(*) from public.invoices i where i.user_id = u.id),
      'ultimo_presupuesto',(select max(b.created_at) from public.budgets b where b.user_id = u.id)
    ) as fila
    from auth.users u
    left join public.profiles p on p.id = u.id
    where q is null
       or u.email ilike '%' || q || '%'
       or p.business_name ilike '%' || q || '%'
       or p.referral_code = upper(q)
    order by u.created_at desc
    limit lim offset off
  ) t;

  return res;
end;
$$;

revoke execute on function public.admin_users(text, int, int) from public, anon;
grant execute on function public.admin_users(text, int, int) to authenticated;


-- ------------------------------------------------------------
-- 5) Activar / renovar una suscripción (cobro manual)
--    Mientras Stripe no esté conectado, este es el registro de pagos:
--    cada activación queda en admin_actions con fecha y quién la hizo.
-- ------------------------------------------------------------
create or replace function public.admin_grant_premium(p_user uuid, p_meses int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  meses int := least(greatest(coalesce(p_meses, 1), 1), 24);
  nuevo timestamptz;
  mail text;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select email into mail from auth.users where id = p_user;
  if mail is null then
    raise exception 'usuario inexistente';
  end if;

  update public.profiles
     set plan          = 'premium',
         premium_since = coalesce(premium_since, now()),
         premium_until = greatest(coalesce(premium_until, now()), now()) + (meses || ' month')::interval
   where id = p_user
  returning premium_until into nuevo;

  insert into public.admin_actions (admin_id, admin_email, action, target_id, target_email, detail)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'grant_premium',
    p_user,
    mail,
    jsonb_build_object('meses', meses, 'premium_until', nuevo)
  );

  return jsonb_build_object('ok', true, 'premium_until', nuevo);
end;
$$;

create or replace function public.admin_revoke_premium(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mail text;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select email into mail from auth.users where id = p_user;
  if mail is null then
    raise exception 'usuario inexistente';
  end if;

  -- Se da de baja el plan pero NO se borra premium_until: queda el
  -- rastro de hasta cuándo había pagado.
  update public.profiles set plan = 'free' where id = p_user;

  insert into public.admin_actions (admin_id, admin_email, action, target_id, target_email, detail)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'revoke_premium',
    p_user,
    mail,
    '{}'::jsonb
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_grant_premium(uuid, int) from public, anon;
revoke execute on function public.admin_revoke_premium(uuid)     from public, anon;
grant execute on function public.admin_grant_premium(uuid, int) to authenticated;
grant execute on function public.admin_revoke_premium(uuid)     to authenticated;


-- ------------------------------------------------------------
-- 6) Historial de acciones (el "libro de pagos" por ahora)
-- ------------------------------------------------------------
create or replace function public.admin_log(p_limit int default 50)
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

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'admin_email', a.admin_email,
      'action', a.action,
      'target_email', a.target_email,
      'detail', a.detail,
      'created_at', a.created_at
    ) order by a.created_at desc)
    from (
      select * from public.admin_actions
       order by created_at desc
       limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) a
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_log(int) from public, anon;
grant execute on function public.admin_log(int) to authenticated;


-- ------------------------------------------------------------
-- 7) Verificación (hacela después de correr la migración)
-- ------------------------------------------------------------
-- a) ¿Quedó registrado el admin?
--    select u.email from public.admins a join auth.users u on u.id = a.user_id;
--    → tiene que aparecer guillemuhana@gmail.com. Si sale vacío, esa
--      cuenta todavía no existe: registrate en la app y volvé a correr
--      el insert del punto 1.
--
-- b) ¿Un usuario común puede espiar el panel? Logueate con OTRA cuenta,
--    abrí la consola del navegador y pegá:
--       await supabase.rpc('admin_users')
--    → tiene que devolver error 'no autorizado'. Si devuelve datos,
--      algo se rompió: no publiques hasta arreglarlo.

-- ============================================================
-- Fin de la migración 12
-- ============================================================
