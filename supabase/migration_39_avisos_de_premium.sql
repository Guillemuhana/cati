-- ============================================================
-- CATI / NUMERA · Migración 39 · AVISAR CUANDO SE REGALA O SE PAGA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   Regalar meses desde /admin cambiaba el plan en la base y nada más.
--   El usuario no se enteraba: ni un aviso en la campanita, ni un mail,
--   nada. Se daba cuenta de casualidad, entrando a una función que
--   antes le pedía suscripción.
--
--   Lo mismo con el pago: el webhook activaba el premium en silencio.
--
--   Regalar algo y no avisar es regalar la mitad.
--
-- LO QUE NO ARREGLA
--   El aviso aparece cuando el navegador vuelve a preguntar. Si la
--   persona tiene la app abierta en ese momento, lo ve en cuanto
--   recarga o cambia de pantalla, no en el segundo exacto.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Regalar meses, ahora con aviso
--    Es la función de la migración 13 con el perform notify_user
--    agregado antes del return. Todo lo demás está igual.
-- ------------------------------------------------------------
create or replace function public.admin_grant_premium(
  p_user uuid,
  p_meses int default 1,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  meses int := least(greatest(coalesce(p_meses, 1), 1), 24);
  motivo text := left(btrim(coalesce(p_motivo, '')), 200);
  nuevo timestamptz;
  mail text;
begin
  -- Admin logueado en la app, o ejecución desde el SQL Editor.
  -- La comprobación va primero que todo: sin esto, el GRANT a
  -- `authenticated` convertiría a este RPC en premium gratis para todos.
  if not (
    public.is_admin()
    or public.caller_role() is null
    or public.caller_role() = 'service_role'
  ) then
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
    coalesce((select email from auth.users where id = auth.uid()), 'SQL Editor'),
    'grant_premium',
    p_user,
    mail,
    jsonb_build_object('meses', meses, 'motivo', nullif(motivo, ''), 'premium_until', nuevo)
  );

  -- El aviso en la campanita.
  --
  -- Sin esto, regalar meses era mudo: el plan cambiaba en la base y el
  -- usuario se enteraba de casualidad, cuando entraba a una función que
  -- antes le pedía suscripción. Regalar algo y no avisar es regalar la
  -- mitad.
  perform public.notify_user(
    p_user,
    'regalo',
    case when meses = 1 then 'Te regalamos 1 mes de premium'
         else 'Te regalamos ' || meses || ' meses de premium' end,
    'Ya tenés todo desbloqueado hasta el ' || to_char(nuevo, 'DD/MM/YYYY') || '.' ||
      case when nullif(motivo, '') is null then '' else ' ' || motivo end,
    '🎁'
  );

  return jsonb_build_object('ok', true, 'premium_until', nuevo, 'meses', meses);
end;
$$;

revoke execute on function public.admin_grant_premium(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_premium(uuid, int, text) to authenticated;


-- ------------------------------------------------------------
-- 2) El pago también avisa
--    Se agrega el aviso dentro de mp_aplicar_suscripcion (migración
--    36), en la rama donde el cobro se acredita.
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
  v_antes    timestamptz;
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
      select premium_until into v_antes from public.profiles where id = v_user;

      -- Nunca se acorta lo que ya tenía.
      v_hasta := greatest(coalesce(p_hasta, now() + interval '1 month'), coalesce(v_antes, now()));

      update public.profiles
         set plan          = 'premium',
             premium_since = coalesce(premium_since, now()),
             premium_until = v_hasta
       where id = v_user;

      v_resuelto := true;
      v_detalle  := 'premium hasta ' || to_char(v_hasta, 'YYYY-MM-DD');

      -- El aviso va solo cuando el premium efectivamente se estiró.
      -- Mercado Pago reintenta y manda varios eventos por el mismo
      -- cobro; sin esta condición, el usuario recibía tres campanitas
      -- por un solo pago.
      if v_antes is null or v_hasta > v_antes then
        -- El tipo importa: la campanita solo destaca y refresca el plan
        -- con los que están en DESTACABLES (Notificaciones.jsx). Con
        -- 'sistema' el aviso aparecía en la lista pero el usuario seguía
        -- viendo la app bloqueada hasta recargar, que es justo lo que
        -- esto viene a evitar.
        perform public.notify_user(
          v_user,
          'suscripcion',
          'Tu suscripción está activa',
          'Gracias. Tenés todo desbloqueado hasta el ' || to_char(v_hasta, 'DD/MM/YYYY') || '.',
          '✅'
        );
      end if;
    else
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

  return jsonb_build_object('user_id', v_user, 'resuelto', v_resuelto, 'detalle', v_detalle);
end;
$$;

revoke execute on function public.mp_aplicar_suscripcion(
  text, text, text, text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) Verificación
--    a) Regalale un mes a alguien y mirá que le quede el aviso:
--         select public.admin_grant_premium('<uuid>', 1, 'prueba');
--         select titulo, cuerpo, icono, created_at
--           from public.notifications
--          where user_id = '<uuid>'
--          order by created_at desc limit 3;
--
--    b) Y que el plan haya cambiado:
--         select plan, premium_until from public.profiles where id = '<uuid>';
-- ============================================================
-- Fin de la migración 39
-- ============================================================
