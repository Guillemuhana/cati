-- ============================================================
-- CATI / NUMERA · Migración 17 · VER PRESUPUESTOS DESDE EL ADMIN
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere las migraciones 12 y 13 corridas antes.
--
-- QUÉ AGREGA
--   Una pestaña "Presupuestos" en /admin con TODOS los presupuestos de
--   TODOS los usuarios, y la posibilidad de abrir uno y ver su detalle
--   completo: ítems, precios, cliente y totales.
--
-- ⚠ ESTO ES DISTINTO A TODO LO ANTERIOR — LEELO
--   Hasta la migración 16 el panel mostraba métricas: cuántos, cuándo,
--   cuánto. Esto muestra el CONTENIDO comercial de tus usuarios: a qué
--   clientes le venden, a qué precios y con qué márgenes. Para un
--   usuario que además es tu competencia, es información que no
--   esperaría que vos veas.
--
--   Por eso:
--     · El LISTADO no trae ítems ni datos del cliente final. Solo
--       número, dueño, monto, estado y fecha: alcanza para soporte y
--       para detectar uso raro, sin abrir nada.
--     · El DETALLE (ítems y cliente) va en una función aparte que se
--       llama con un clic explícito, y CADA APERTURA QUEDA REGISTRADA
--       en admin_actions. Si algún día sumás un socio o un empleado al
--       panel, vas a poder ver quién miró qué.
--     · El detalle NO devuelve el email ni el teléfono del cliente
--       final: ese es un tercero que nunca aceptó tus términos. Se
--       muestra el nombre, que es lo que hace falta para dar soporte.
--
--   Si esto te parece demasiado para lo que necesitabas, la pestaña
--   funciona igual sin abrir ningún detalle.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Listado de presupuestos de todos los usuarios
--    Sin contenido: es un índice, no una lectura.
-- ------------------------------------------------------------
create or replace function public.admin_budgets(
  p_search text default null,
  p_user uuid default null,
  p_status text default null,
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
  est text;
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  q := nullif(btrim(coalesce(p_search, '')), '');
  est := nullif(btrim(coalesce(p_status, '')), '');

  select count(*) into total
    from public.budgets b
    join auth.users u on u.id = b.user_id
    left join public.profiles p on p.id = b.user_id
    left join public.clients c on c.id = b.client_id
   where (p_user is null or b.user_id = p_user)
     and (est is null or b.status = est)
     and (q is null
          or u.email ilike '%' || q || '%'
          or p.business_name ilike '%' || q || '%'
          or c.name ilike '%' || q || '%'
          or b.title ilike '%' || q || '%'
          or b.numero::text = q);

  select jsonb_build_object(
    'total', total,
    'limit', lim,
    'offset', off,
    'presupuestos', coalesce(jsonb_agg(fila order by (fila->>'created_at') desc), '[]'::jsonb)
  ) into res
  from (
    select jsonb_build_object(
      'id',         b.id,
      'numero',     b.numero,
      'titulo',     nullif(btrim(coalesce(b.title, '')), ''),
      'estado',     b.status,
      'moneda',     b.currency,
      'total',      b.total,
      'items',      (select count(*) from public.budget_items i where i.budget_id = b.id),
      'issue_date', b.issue_date,
      'created_at', b.created_at,

      -- Quién lo hizo (tu usuario).
      'user_id',    b.user_id,
      'email',      u.email,
      'negocio',    p.business_name,
      'prefijo',    p.number_prefix,

      -- A quién se lo hizo: solo el nombre, no el contacto.
      'cliente',    c.name
    ) as fila
    from public.budgets b
    join auth.users u on u.id = b.user_id
    left join public.profiles p on p.id = b.user_id
    left join public.clients c on c.id = b.client_id
    where (p_user is null or b.user_id = p_user)
      and (est is null or b.status = est)
      and (q is null
           or u.email ilike '%' || q || '%'
           or p.business_name ilike '%' || q || '%'
           or c.name ilike '%' || q || '%'
           or b.title ilike '%' || q || '%'
           or b.numero::text = q)
    order by b.created_at desc
    limit lim offset off
  ) t;

  return res;
end;
$$;

revoke execute on function public.admin_budgets(text, uuid, text, int, int) from public, anon;
grant execute on function public.admin_budgets(text, uuid, text, int, int) to authenticated;


-- ------------------------------------------------------------
-- 2) Detalle de UN presupuesto, con ítems
--
--    NO es `stable`: escribe en admin_actions. Una función stable no
--    puede hacer INSERT, y además Postgres podría cachear su resultado
--    dentro de la misma consulta y saltearse el registro.
-- ------------------------------------------------------------
create or replace function public.admin_budget_detail(p_budget uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  res jsonb;
  duenio uuid;
  mail text;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  select b.user_id into duenio from public.budgets b where b.id = p_budget;
  if duenio is null then
    raise exception 'presupuesto inexistente';
  end if;

  select email into mail from auth.users where id = duenio;

  select jsonb_build_object(
    'presupuesto', jsonb_build_object(
      'id',              b.id,
      'numero',          b.numero,
      'titulo',          b.title,
      'estado',          b.status,
      'issue_date',      b.issue_date,
      'due_date',        b.due_date,
      'moneda',          b.currency,
      'subtotal',        b.subtotal,
      'discount_amount', b.discount_amount,
      'tax_rate',        b.tax_rate,
      'tax_amount',      b.tax_amount,
      'total',           b.total,
      'notas',           nullif(btrim(coalesce(b.notes, '')), ''),
      'condiciones',     nullif(btrim(coalesce(b.terms, '')), ''),
      'created_at',      b.created_at,
      'updated_at',      b.updated_at
    ),

    'usuario', jsonb_build_object(
      'id',      u.id,
      'email',   u.email,
      'negocio', p.business_name
    ),

    -- Del cliente final, solo el nombre: es un tercero ajeno a la app.
    'cliente', (select c.name from public.clients c where c.id = b.client_id),

    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description,
        'quantity',    i.quantity,
        'unit_price',  i.unit_price,
        'discount',    i.discount
      ) order by i.position, i.description)
      from public.budget_items i where i.budget_id = b.id
    ), '[]'::jsonb)
  ) into res
  from public.budgets b
  join auth.users u on u.id = b.user_id
  left join public.profiles p on p.id = b.user_id
  where b.id = p_budget;

  -- Queda registrado quién abrió qué y cuándo.
  insert into public.admin_actions (admin_id, admin_email, action, target_id, target_email, detail)
  values (
    auth.uid(),
    coalesce((select email from auth.users where id = auth.uid()), 'SQL Editor'),
    'view_budget',
    duenio,
    mail,
    jsonb_build_object('budget_id', p_budget)
  );

  return res;
end;
$$;

revoke execute on function public.admin_budget_detail(uuid) from public, anon;
grant execute on function public.admin_budget_detail(uuid) to authenticated;


-- ------------------------------------------------------------
-- 3) Verificación
-- ------------------------------------------------------------
-- a) Listado:
--      select public.admin_budgets(null, null, null, 10, 0);
--
-- b) Detalle de uno (pegá un id del listado):
--      select public.admin_budget_detail('...uuid...');
--    Después revisá que quedó el registro:
--      select action, target_email, detail, created_at
--        from public.admin_actions where action = 'view_budget'
--       order by created_at desc limit 5;
--
-- c) ¿Un usuario común puede verlo? Logueate con OTRA cuenta y en la
--    consola del navegador:
--      await supabase.rpc('admin_budgets')
--    → tiene que devolver 'no autorizado'.

-- ============================================================
-- Fin de la migración 17
-- ============================================================
