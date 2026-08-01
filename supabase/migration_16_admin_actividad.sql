-- ============================================================
-- CATI / NUMERA · Migración 16 · ACTIVIDAD DE LOS USUARIOS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere las migraciones 12 y 13 corridas antes.
--
-- QUÉ AGREGA
--   Una pestaña "Actividad" en /admin para ver qué está pasando en la
--   app día a día: quién entró y cuándo, quién se registró, quién armó
--   presupuestos. Antes esto solo se veía usuario por usuario, abriendo
--   la ficha de cada uno.
--
-- ⚠ DE DÓNDE SALEN LOS INGRESOS
--   De auth.audit_log_entries, la tabla que Supabase escribe sola en
--   cada login. Tiene dos limitaciones que conviene saber de antemano:
--
--     1. Supabase la PURGA sola (retención de pocas semanas en los
--        planes chicos). No sirve como historial de largo plazo: para
--        eso está profiles.last_sign_in_at, que es un solo valor pero
--        no se borra.
--     2. El nombre de sus columnas cambió entre versiones de Supabase.
--        Por eso, igual que en la migración 13, todo lo que la toca va
--        envuelto en un bloque con EXCEPTION: si algún día no coincide,
--        la pestaña muestra vacío en vez de romperse entera.
--
-- ⚠ ESTO ES DATO PERSONAL
--   Un feed de "quién entró y desde qué IP" es vigilancia de tus
--   usuarios. Sirve para lo operativo (ver si la app se usa, detectar
--   multicuentas), no para espiar. La IP queda fuera del feed general
--   y solo aparece en la ficha individual, que se abre a propósito.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Ingresos (logins) de TODOS los usuarios
--    Se separa en su propia función, igual que admin_user_logins, para
--    aislar el riesgo del cambio de esquema de auth.
-- ------------------------------------------------------------
create or replace function public.admin_logins(
  p_days int default 7,
  p_limit int default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  res jsonb;
  dias int := least(greatest(coalesce(p_days, 7), 1), 90);
  lim  int := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  begin
    select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) into res
    from (
      select jsonb_build_object(
        'tipo',   'ingreso',
        'fecha',  a.created_at,
        'accion', a.payload->>'action',
        'user_id', (a.payload->>'actor_id')::uuid,
        'email',  coalesce(a.payload->>'actor_username', u.email),
        'negocio', p.business_name
      ) as x
      from auth.audit_log_entries a
      left join auth.users u on u.id = (a.payload->>'actor_id')::uuid
      left join public.profiles p on p.id = u.id
      where a.created_at >= now() - (dias || ' days')::interval
        -- Solo entradas reales: se descartan refresh de token, logout y
        -- el ruido de recuperación de contraseña.
        and a.payload->>'action' in ('login', 'user_signedup')
        and a.payload->>'actor_id' is not null
      order by a.created_at desc
      limit lim
    ) t;
  exception when others then
    res := '[]'::jsonb;
  end;

  return coalesce(res, '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_logins(int, int) from public, anon;
grant execute on function public.admin_logins(int, int) to authenticated;


-- ------------------------------------------------------------
-- 2) Ingresos por día, para ver la tendencia de uso
--    Se arma sobre generate_series para que los días sin actividad
--    aparezcan en cero: un gráfico con huecos miente sobre la forma
--    de la curva.
-- ------------------------------------------------------------
create or replace function public.admin_logins_por_dia(p_days int default 28)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  res jsonb;
  dias int := least(greatest(coalesce(p_days, 28), 1), 90);
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  begin
    select coalesce(jsonb_agg(
             jsonb_build_object('dia', d.dia, 'ingresos', d.ingresos, 'usuarios', d.usuarios)
             order by d.dia
           ), '[]'::jsonb) into res
    from (
      select
        s.dia::date as dia,
        count(a.*) as ingresos,
        count(distinct a.payload->>'actor_id') as usuarios
      from generate_series(
             date_trunc('day', now()) - ((dias - 1) || ' days')::interval,
             date_trunc('day', now()),
             '1 day'
           ) s(dia)
      left join auth.audit_log_entries a
        on date_trunc('day', a.created_at) = s.dia
       and a.payload->>'action' = 'login'
      group by s.dia
    ) d;
  exception when others then
    res := '[]'::jsonb;
  end;

  return coalesce(res, '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_logins_por_dia(int) from public, anon;
grant execute on function public.admin_logins_por_dia(int) to authenticated;


-- ------------------------------------------------------------
-- 3) Feed unificado de actividad
--    Mezcla ingresos, altas de cuenta y presupuestos creados en una
--    sola línea de tiempo ordenada por fecha.
--
--    Las altas y los presupuestos NO dependen de auth.audit_log_entries,
--    así que si esa tabla falla o Supabase la purga, el feed sigue
--    mostrando algo útil.
-- ------------------------------------------------------------
create or replace function public.admin_actividad(
  p_days int default 7,
  p_limit int default 150
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  res jsonb;
  dias int := least(greatest(coalesce(p_days, 7), 1), 90);
  lim  int := least(greatest(coalesce(p_limit, 150), 1), 500);
  desde timestamptz;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  desde := now() - (dias || ' days')::interval;

  select jsonb_build_object(
    'desde', desde,
    'dias',  dias,

    -- Resumen del período elegido.
    'resumen', jsonb_build_object(
      'altas', (select count(*) from auth.users u where u.created_at >= desde),
      'presupuestos', (select count(*) from public.budgets b where b.created_at >= desde),
      'aceptados', (select count(*) from public.budgets b
                     where b.created_at >= desde and b.status = 'aceptado'),
      'usuarios_activos', (select count(distinct b.user_id) from public.budgets b
                            where b.created_at >= desde),
      'ingresos', jsonb_array_length(public.admin_logins(dias, 500))
    ),

    -- El LIMIT va acá adentro, sobre las filas, y NO afuera: jsonb_agg
    -- colapsa todo en una sola fila, así que un limit por fuera del
    -- agregado limitaría a "1 resultado" y dejaría pasar los miles de
    -- eventos igual.
    'eventos', (
      select coalesce(jsonb_agg(e order by (e->>'fecha') desc), '[]'::jsonb)
      from (
        select e from (
        select * from jsonb_array_elements(public.admin_logins(dias, lim)) as e

        union all

        -- Altas de cuenta
        select jsonb_build_object(
          'tipo',    'alta',
          'fecha',   u.created_at,
          'user_id', u.id,
          'email',   u.email,
          'negocio', p.business_name
        )
        from auth.users u
        left join public.profiles p on p.id = u.id
        where u.created_at >= desde

        union all

        -- Presupuestos creados
        select jsonb_build_object(
          'tipo',    'presupuesto',
          'fecha',   b.created_at,
          'user_id', b.user_id,
          'email',   u.email,
          'negocio', p.business_name,
          'detalle', jsonb_build_object(
            'numero', b.numero,
            'estado', b.status,
            'total',  b.total,
            'moneda', b.currency
          )
        )
        from public.budgets b
        join auth.users u on u.id = b.user_id
        left join public.profiles p on p.id = u.id
        where b.created_at >= desde
        ) todos(e)
        order by (e->>'fecha') desc
        limit lim
      ) eventos(e)
    ),

    'por_dia', public.admin_logins_por_dia(least(dias, 28))
  ) into res;

  return res;
end;
$$;

revoke execute on function public.admin_actividad(int, int) from public, anon;
grant execute on function public.admin_actividad(int, int) to authenticated;


-- ------------------------------------------------------------
-- 4) Más historial en la ficha individual
--    5 conexiones era muy poco para darse cuenta de un patrón.
--    Misma función, solo cambia el tope por defecto.
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

    'invitados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email',  r.invited_masked,
        'estado', r.status,
        'fecha',  r.created_at
      ) order by r.created_at)
      from public.referrals r where r.referrer_id = p_user
    ), '[]'::jsonb),

    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'accion', a.action,
        'detail', a.detail,
        'admin',  a.admin_email,
        'fecha',  a.created_at
      ) order by a.created_at desc)
      from public.admin_actions a where a.target_id = p_user
    ), '[]'::jsonb),

    -- Antes 5. Con 20 ya se ve si entra todos los días o desapareció.
    'conexiones', public.admin_user_logins(p_user, 20)
  ) into res;

  return res;
end;
$$;

revoke execute on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5) Verificación (hacela después de correr la migración)
-- ------------------------------------------------------------
-- a) ¿Hay registro de ingresos?
--      select public.admin_logins(7, 20);
--    → si devuelve [] pero vos entraste esta semana, es el caso 2 del
--      encabezado: el esquema de auth.audit_log_entries no coincide.
--      El resto de la pestaña (altas y presupuestos) igual funciona.
--
-- b) ¿El feed completo responde?
--      select public.admin_actividad(7, 50);
--
-- c) ¿Un usuario común puede verlo? Logueate con OTRA cuenta y en la
--    consola del navegador:
--      await supabase.rpc('admin_actividad')
--    → tiene que devolver 'no autorizado'.

-- ============================================================
-- Fin de la migración 16
-- ============================================================
