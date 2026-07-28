-- ============================================================
-- CATI / NUMERA · Migración 07 · ENDURECIMIENTO DE SEGURIDAD
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos.
--
-- QUÉ ARREGLA (en orden de gravedad):
--   1. CRÍTICO: cualquier usuario podía darse premium solo (o
--      extender la prueba de 72 h para siempre) con una sola
--      llamada desde la consola del navegador.
--   2. ALTO: las funciones premium se bloqueaban SOLO en React.
--      Llamando a la API REST directamente se usaban igual.
--   3. MEDIO: el enlace público seguía funcionando para cuentas
--      sin suscripción, y se podía cambiar el estado
--      aceptado/rechazado infinitas veces.
--   4. MEDIO: el bucket de logos aceptaba cualquier archivo de
--      cualquier tamaño (se podía usar tu Storage para alojar
--      malware / phishing y quemarte la cuota).
--   5. MEDIO: el perfil (y la prueba gratis) lo creaba el cliente.
--      Ahora lo crea la base de datos.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Helper: ¿este usuario tiene acceso premium AHORA?
--    Fuente de verdad ÚNICA, del lado del servidor.
--    (El hook usePlan de React ahora es solo cosmético.)
-- ------------------------------------------------------------
create or replace function public.is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        -- suscripción paga vigente
        (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))
        -- o prueba gratuita vigente
        or (p.trial_ends_at is not null and p.trial_ends_at > now())
      from public.profiles p
      where p.id = p_user
    ),
    false
  );
$$;

revoke execute on function public.is_premium(uuid) from public;
grant execute on function public.is_premium(uuid) to authenticated, service_role;


-- ============================================================
-- 1) CRÍTICO · Nadie puede auto-asignarse premium
-- ============================================================

-- 1.a) Permisos a nivel COLUMNA: el cliente solo puede tocar los
--      campos del negocio. Un UPDATE que incluya plan /
--      trial_ends_at / premium_until es rechazado por Postgres
--      antes de llegar a las políticas RLS.
revoke insert, update on public.profiles from anon, authenticated;

grant update (
  business_name,
  email,
  phone,
  tax_id,
  address,
  logo_url,
  currency,
  default_terms,
  default_payment_terms,
  default_payment_methods,
  bank_alias,
  brand_color,
  number_prefix,
  hide_branding
) on public.profiles to authenticated;

-- 1.b) Segundo cerrojo (por si algún día se vuelve a dar el GRANT):
--      un trigger que restaura los campos de facturación al valor
--      anterior cuando quien edita es el cliente.
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo aplica a peticiones que vienen de la API pública.
  -- Desde el SQL Editor (rol postgres) o con service_role, no aplica.
  if current_user in ('authenticated', 'anon') then
    new.id            := old.id;
    new.plan          := old.plan;
    new.trial_ends_at := old.trial_ends_at;
    new.premium_since := old.premium_since;
    new.premium_until := old.premium_until;

    -- Quitar la marca "Generado con Numera" es una función premium.
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

-- 1.c) El perfil y la prueba de 72 h los crea la BASE DE DATOS,
--      no el navegador. Así nadie se auto-regala una prueba eterna.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, business_name, plan, trial_ends_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'business_name', ''),
    'free',
    now() + interval '72 hours'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 1.d) El cliente ya no inserta perfiles.
drop policy if exists "profiles: insert own" on public.profiles;

-- 1.e) Backfill: perfiles faltantes de usuarios ya registrados.
insert into public.profiles (id, email, business_name, plan, trial_ends_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'business_name', ''),
  'free',
  now() + interval '72 hours'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;


-- ============================================================
-- 2) ALTO · Las funciones premium se bloquean en la BASE DE DATOS
--    Patrón: si se te vence la suscripción NO perdés tus datos
--    (podés leerlos y borrarlos), pero no podés crear ni editar.
-- ============================================================

-- 2.a) Catálogo de productos
drop policy if exists "products: all own"        on public.products;
drop policy if exists "products: select own"     on public.products;
drop policy if exists "products: delete own"     on public.products;
drop policy if exists "products: insert premium" on public.products;
drop policy if exists "products: update premium" on public.products;

create policy "products: select own" on public.products
  for select using (auth.uid() = user_id);
create policy "products: delete own" on public.products
  for delete using (auth.uid() = user_id);
create policy "products: insert premium" on public.products
  for insert with check (auth.uid() = user_id and public.is_premium(auth.uid()));
create policy "products: update premium" on public.products
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

-- 2.b) Plantillas de presupuesto
drop policy if exists "templates: all own"        on public.budget_templates;
drop policy if exists "templates: select own"     on public.budget_templates;
drop policy if exists "templates: delete own"     on public.budget_templates;
drop policy if exists "templates: insert premium" on public.budget_templates;
drop policy if exists "templates: update premium" on public.budget_templates;

create policy "templates: select own" on public.budget_templates
  for select using (auth.uid() = user_id);
create policy "templates: delete own" on public.budget_templates
  for delete using (auth.uid() = user_id);
create policy "templates: insert premium" on public.budget_templates
  for insert with check (auth.uid() = user_id and public.is_premium(auth.uid()));
create policy "templates: update premium" on public.budget_templates
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

-- 2.c) Facturas / comprobantes
drop policy if exists "invoices: all own"        on public.invoices;
drop policy if exists "invoices: select own"     on public.invoices;
drop policy if exists "invoices: delete own"     on public.invoices;
drop policy if exists "invoices: insert premium" on public.invoices;
drop policy if exists "invoices: update premium" on public.invoices;

create policy "invoices: select own" on public.invoices
  for select using (auth.uid() = user_id);
create policy "invoices: delete own" on public.invoices
  for delete using (auth.uid() = user_id);
create policy "invoices: insert premium" on public.invoices
  for insert with check (auth.uid() = user_id and public.is_premium(auth.uid()));
create policy "invoices: update premium" on public.invoices
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

-- 2.d) Recibos
drop policy if exists "receipts: all own"        on public.receipts;
drop policy if exists "receipts: select own"     on public.receipts;
drop policy if exists "receipts: delete own"     on public.receipts;
drop policy if exists "receipts: insert premium" on public.receipts;
drop policy if exists "receipts: update premium" on public.receipts;

create policy "receipts: select own" on public.receipts
  for select using (auth.uid() = user_id);
create policy "receipts: delete own" on public.receipts
  for delete using (auth.uid() = user_id);
create policy "receipts: insert premium" on public.receipts
  for insert with check (auth.uid() = user_id and public.is_premium(auth.uid()));
create policy "receipts: update premium" on public.receipts
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));


-- ============================================================
-- 3) MEDIO · Enlace público: solo cuentas premium + no se puede
--    cambiar la respuesta una vez decidida.
-- ============================================================

create or replace function public.get_public_budget(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.budgets;
begin
  select * into b from public.budgets where public_token = p_token;
  if not found then
    return null;
  end if;

  -- El enlace público es función premium: si el dueño no tiene
  -- suscripción activa, el link deja de servir.
  if not public.is_premium(b.user_id) then
    return null;
  end if;

  if b.viewed_at is null then
    update public.budgets
      set viewed_at = now(),
          status = case when status = 'enviado' then 'visto' else status end
      where id = b.id;
    select * into b from public.budgets where id = b.id;
  end if;

  return jsonb_build_object(
    -- Nunca exponemos user_id ni el token secreto al HTML público.
    'budget', to_jsonb(b) - 'user_id' - 'public_token',
    'items', coalesce(
      (select jsonb_agg(to_jsonb(i) - 'budget_id' order by i.position)
         from public.budget_items i where i.budget_id = b.id),
      '[]'::jsonb
    ),
    'business', (
      select jsonb_build_object(
        'business_name', p.business_name,
        'logo_url', p.logo_url,
        'email', p.email,
        'phone', p.phone,
        'tax_id', p.tax_id,
        'address', p.address,
        'bank_alias', p.bank_alias,
        'brand_color', p.brand_color,
        'hide_branding', p.hide_branding
      )
      from public.profiles p where p.id = b.user_id
    )
  );
end;
$$;

create or replace function public.set_budget_response(p_token uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.budgets;
begin
  if p_action not in ('aceptado', 'rechazado') then
    raise exception 'accion invalida';
  end if;

  select * into b from public.budgets where public_token = p_token;
  if not found then
    return null;
  end if;

  if not public.is_premium(b.user_id) then
    return null;
  end if;

  -- Una vez que el cliente decidió, la decisión queda congelada.
  -- (Antes cualquiera con el link podía alternar aceptado/rechazado
  --  todas las veces que quisiera.)
  if b.status in ('aceptado', 'rechazado') then
    return jsonb_build_object('ok', false, 'status', b.status, 'reason', 'ya_respondido');
  end if;

  update public.budgets
    set status = p_action,
        accepted_at = case when p_action = 'aceptado' then now() else accepted_at end,
        rejected_at = case when p_action = 'rechazado' then now() else rejected_at end
    where id = b.id
    returning * into b;

  return jsonb_build_object('ok', true, 'status', b.status);
end;
$$;

-- Permite invalidar un enlace ya compartido (genera un token nuevo).
create or replace function public.rotate_budget_token(p_budget uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t uuid;
begin
  update public.budgets
    set public_token = gen_random_uuid()
    where id = p_budget and user_id = auth.uid()
    returning public_token into t;
  return t;
end;
$$;

revoke execute on function public.rotate_budget_token(uuid) from public, anon;
grant execute on function public.rotate_budget_token(uuid) to authenticated;

grant execute on function public.get_public_budget(uuid)         to anon, authenticated;
grant execute on function public.set_budget_response(uuid, text) to anon, authenticated;


-- ============================================================
-- 4) MEDIO · Bucket de logos: límite de tamaño y tipos
--    Sin esto se puede subir un .exe de 200 MB a tu Storage.
-- ============================================================
update storage.buckets
  set file_size_limit    = 2097152,  -- 2 MB
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
  where id = 'logos';

-- El bucket es público (los logos aparecen en presupuestos compartidos),
-- pero no hace falta que se pueda LISTAR el contenido de todos.
drop policy if exists "logos: lectura pública" on storage.objects;
create policy "logos: lectura pública"
  on storage.objects for select
  using (bucket_id = 'logos');


-- ============================================================
-- 5) ADMIN · Activar / renovar / dar de baja una suscripción
--    Solo ejecutable desde el SQL Editor o con service_role.
--    NUNCA se expone al navegador.
-- ============================================================
create or replace function public.admin_set_premium(p_email text, p_meses int default 1)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    return 'usuario no encontrado: ' || p_email;
  end if;

  update public.profiles
    set plan          = 'premium',
        premium_since = coalesce(premium_since, now()),
        premium_until = greatest(coalesce(premium_until, now()), now())
                        + (p_meses || ' month')::interval
    where id = uid;

  return 'premium hasta ' ||
         (select premium_until::text from public.profiles where id = uid);
end;
$$;

create or replace function public.admin_cancel_premium(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    return 'usuario no encontrado: ' || p_email;
  end if;

  update public.profiles set plan = 'free' where id = uid;
  return 'suscripcion cancelada';
end;
$$;

-- Estas dos NO son accesibles desde la app (anon/authenticated).
revoke execute on function public.admin_set_premium(text, int)  from public, anon, authenticated;
revoke execute on function public.admin_cancel_premium(text)    from public, anon, authenticated;
grant  execute on function public.admin_set_premium(text, int)  to service_role;
grant  execute on function public.admin_cancel_premium(text)    to service_role;

-- Uso:
--   select public.admin_set_premium('cliente@ejemplo.com', 1);
--   select public.admin_cancel_premium('cliente@ejemplo.com');

-- ============================================================
-- Fin de la migración 07
-- ============================================================
