-- ============================================================
-- CATI / NUMERA · Migración 13 · FICHA DE USUARIO Y REGALOS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la migración 12 corrida antes.
--
-- QUÉ AGREGA
--   1. Más datos en el listado: contacto, zona y de dónde salió cada
--      usuario (registro directo o invitado por alguien).
--   2. Ficha completa de un usuario (admin_user_detail): datos del
--      negocio, últimas conexiones con IP, actividad y presupuestos.
--   3. Regalar meses con un motivo, que queda registrado.
--
-- ⚠ SOBRE LAS IP Y LOS DATOS PERSONALES
--   La ficha muestra las últimas conexiones con su IP. Sirve para lo
--   que sirve de verdad: detectar a alguien que se crea 3 cuentas
--   desde la misma conexión para cobrarse el premio de invitaciones.
--   No es un dato para andar mostrando: si algún día tenés empleados
--   o socios con acceso al panel, esto es dato personal de tus
--   usuarios y te aplica la ley de protección de datos. Por eso la IP
--   está en la ficha individual (que se abre a propósito) y no en el
--   listado general.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Listado con datos de contacto y origen
--    Reemplaza la versión de la migración 12.
--    Acá NO va la IP: este listado trae hasta 200 filas de una y
--    consultar el log de auditoría por cada una sería lentísimo.
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
      or p.phone ilike '%' || q || '%'
      or p.address ilike '%' || q || '%'
      or p.tax_id ilike '%' || q || '%'
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

      -- Quién es y de dónde: lo que el propio usuario cargó en su perfil.
      'phone',             p.phone,
      'address',           p.address,
      'tax_id',            p.tax_id,
      'currency',          p.currency,
      'contacto_email',    p.email,

      -- De dónde salió: invitación o registro directo.
      'invitado_por',      (select u2.email from auth.users u2 where u2.id = p.referred_by),
      'origen',            case when p.referred_by is not null then 'invitación' else 'directo' end,

      'plan',              coalesce(p.plan, 'free'),
      'trial_ends_at',     p.trial_ends_at,
      'premium_until',     p.premium_until,
      'es_premium',        (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now())),
      'en_prueba',         (coalesce(p.plan,'free') <> 'premium' and p.trial_ends_at > now()),
      'referral_code',     p.referral_code,
      'referidos',         coalesce(p.referrals_count, 0),
      'premio_referidos',  p.referral_bonus_at,

      'presupuestos',      (select count(*) from public.budgets b  where b.user_id = u.id),
      'clientes',          (select count(*) from public.clients c  where c.user_id = u.id),
      'facturas',          (select count(*) from public.invoices i where i.user_id = u.id),
      'ultimo_presupuesto',(select max(b.created_at) from public.budgets b where b.user_id = u.id),
      'regalos',           (select count(*) from public.admin_actions a
                             where a.target_id = u.id and a.action = 'grant_premium')
    ) as fila
    from auth.users u
    left join public.profiles p on p.id = u.id
    where q is null
       or u.email ilike '%' || q || '%'
       or p.business_name ilike '%' || q || '%'
       or p.phone ilike '%' || q || '%'
       or p.address ilike '%' || q || '%'
       or p.tax_id ilike '%' || q || '%'
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
-- 2) Últimas conexiones de UN usuario (con IP)
--    En una función aparte y con manejo de error: el nombre de las
--    columnas de auth.audit_log_entries cambió entre versiones de
--    Supabase, y si algún día no coincide preferimos devolver vacío
--    antes que romper toda la ficha.
-- ------------------------------------------------------------
create or replace function public.admin_user_logins(p_user uuid, p_limit int default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  res jsonb;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  begin
    select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) into res
    from (
      select jsonb_build_object(
        'fecha',  a.created_at,
        'accion', a.payload->>'action',
        'ip',     coalesce(a.payload->>'ip_address', a.ip_address)
      ) as x
      from auth.audit_log_entries a
      where a.payload->>'actor_id' = p_user::text
      order by a.created_at desc
      limit least(greatest(coalesce(p_limit, 5), 1), 50)
    ) t;
  exception when others then
    -- Tabla o columna distinta a la esperada: la ficha sigue andando.
    res := '[]'::jsonb;
  end;

  return coalesce(res, '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_user_logins(uuid, int) from public, anon;
grant execute on function public.admin_user_logins(uuid, int) to authenticated;


-- ------------------------------------------------------------
-- 3) Ficha completa de un usuario
-- ------------------------------------------------------------
create or replace function public.admin_user_detail(p_user uuid)
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
    'perfil', (
      select jsonb_build_object(
        'id',            u.id,
        'email',         u.email,
        'business_name', p.business_name,
        'contacto_email',p.email,
        'phone',         p.phone,
        'address',       p.address,
        'tax_id',        p.tax_id,
        'currency',      p.currency,
        'bank_alias',    p.bank_alias,
        'logo_url',      p.logo_url,
        'number_prefix', p.number_prefix,
        'created_at',    u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'email_confirmado', u.email_confirmed_at is not null,
        'plan',          coalesce(p.plan, 'free'),
        'trial_ends_at', p.trial_ends_at,
        'premium_since', p.premium_since,
        'premium_until', p.premium_until,
        'referral_code', p.referral_code,
        'invitado_por',  (select u2.email from auth.users u2 where u2.id = p.referred_by),
        'premio_referidos', p.referral_bonus_at
      )
      from auth.users u
      left join public.profiles p on p.id = u.id
      where u.id = p_user
    ),

    -- Actividad: qué tanto usa la app.
    'actividad', (
      select jsonb_build_object(
        'presupuestos',      count(*),
        'ultimos_30',        count(*) filter (where b.created_at >= now() - interval '30 days'),
        'aceptados',         count(*) filter (where b.status = 'aceptado'),
        'primer_presupuesto',min(b.created_at),
        'ultimo_presupuesto',max(b.created_at)
      )
      from public.budgets b where b.user_id = p_user
    ),

    'montos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'moneda',   b.currency,
        'emitido',  round(sum(b.total)::numeric, 2),
        'aceptado', round(sum(b.total) filter (where b.status = 'aceptado')::numeric, 2)
      ) order by b.currency)
      from public.budgets b where b.user_id = p_user
      group by b.currency
    ), '[]'::jsonb),

    'otros', jsonb_build_object(
      'clientes',  (select count(*) from public.clients  c where c.user_id = p_user),
      'productos', (select count(*) from public.products pr where pr.user_id = p_user),
      'facturas',  (select count(*) from public.invoices i where i.user_id = p_user)
    ),

    -- A quiénes invitó (email tapado, igual que lo ve el propio usuario).
    'invitados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email',  r.invited_masked,
        'estado', r.status,
        'fecha',  r.created_at
      ) order by r.created_at)
      from public.referrals r where r.referrer_id = p_user
    ), '[]'::jsonb),

    -- Historial de regalos y bajas de esta cuenta.
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'accion', a.action,
        'detail', a.detail,
        'admin',  a.admin_email,
        'fecha',  a.created_at
      ) order by a.created_at desc)
      from public.admin_actions a where a.target_id = p_user
    ), '[]'::jsonb),

    'conexiones', public.admin_user_logins(p_user, 5)
  ) into res;

  return res;
end;
$$;

revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4) Regalar meses, con motivo
--    Reemplaza admin_grant_premium(uuid, int) por una versión con
--    motivo. Se elimina la anterior para que no queden dos funciones
--    con el mismo nombre (Postgres no sabría cuál llamar).
-- ------------------------------------------------------------
drop function if exists public.admin_grant_premium(uuid, int);

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

  return jsonb_build_object('ok', true, 'premium_until', nuevo, 'meses', meses);
end;
$$;

revoke execute on function public.admin_grant_premium(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_premium(uuid, int, text) to authenticated;


-- ------------------------------------------------------------
-- 5) BUG ENCONTRADO · el segundo cerrojo de la migración 07 no servía
--
--    profiles_guard() pregunta `current_user in ('authenticated','anon')`
--    para saber si quien edita es el navegador. El detalle: dentro de
--    una función SECURITY DEFINER, current_user es el DUEÑO de la
--    función (postgres), nunca el que llama. O sea que esa condición
--    daba false siempre y el guard no restauraba nada.
--
--    No hubo agujero real: lo que protege de verdad es el GRANT por
--    columna del punto 1.a de la migración 07, y ese sí funciona. Pero
--    el "segundo cerrojo" era decorativo, y un cerrojo decorativo es
--    peor que no tenerlo, porque uno cuenta con él.
--
--    La forma correcta de saber quién llama es mirar el rol del JWT.
-- ------------------------------------------------------------
create or replace function public.caller_role()
returns text
language sql
stable
as $$
  -- Devuelve 'authenticated' / 'anon' / 'service_role' según el token,
  -- o NULL si no hay token (SQL Editor, cron, psql).
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
$$;

grant execute on function public.caller_role() to authenticated, anon, service_role;

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ahora sí: solo se aplica cuando la petición viene de la API pública.
  if public.caller_role() in ('authenticated', 'anon') then
    new.id                := old.id;
    new.plan              := old.plan;
    new.trial_ends_at     := old.trial_ends_at;
    new.premium_since     := old.premium_since;
    new.premium_until     := old.premium_until;
    new.referral_code     := old.referral_code;
    new.referred_by       := old.referred_by;
    new.referrals_count   := old.referrals_count;
    new.referral_bonus_at := old.referral_bonus_at;

    if new.hide_branding and not public.is_premium(old.id) then
      new.hide_branding := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Las acciones hechas desde el SQL Editor no tienen un admin logueado
-- detrás, así que admin_id tiene que poder ser nulo.
alter table public.admin_actions alter column admin_id drop not null;


-- ------------------------------------------------------------
-- 6) Regalar a VARIOS de una (campañas)
--    Ejemplo: "3 meses a todos los que hicieron más de 5 presupuestos".
--    Se ejecuta desde el SQL Editor, no desde la app, justamente para
--    que un clic accidental no regale 200 suscripciones.
-- ------------------------------------------------------------
create or replace function public.admin_grant_premium_bulk(
  p_emails text[],
  p_meses int default 1,
  p_motivo text default 'campaña'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mail text;
  uid uuid;
  ok int := 0;
  fallidos text[] := '{}';
begin
  -- Admin logueado, o ejecución sin token (SQL Editor / service_role).
  if not (
    public.is_admin()
    or public.caller_role() is null
    or public.caller_role() = 'service_role'
  ) then
    raise exception 'no autorizado';
  end if;

  foreach mail in array coalesce(p_emails, '{}') loop
    select id into uid from auth.users where lower(email) = lower(btrim(mail));
    if uid is null then
      fallidos := fallidos || mail;
    else
      perform public.admin_grant_premium(uid, p_meses, p_motivo);
      ok := ok + 1;
    end if;
  end loop;

  return jsonb_build_object('otorgados', ok, 'no_encontrados', to_jsonb(fallidos));
end;
$$;

revoke execute on function public.admin_grant_premium_bulk(text[], int, text) from public, anon, authenticated;
grant execute on function public.admin_grant_premium_bulk(text[], int, text) to service_role;

-- Uso desde el SQL Editor:
--   select public.admin_grant_premium_bulk(
--     array['uno@mail.com','dos@mail.com'], 3, 'regalo de fin de año'
--   );


-- ============================================================
-- Fin de la migración 13
-- ============================================================
