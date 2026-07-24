-- ============================================================
-- CATI · Migración 03 · Catálogo, plantillas, enlace público y marca
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos existentes.
-- ============================================================

-- 1) Catálogo de productos/servicios -------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
drop policy if exists "products: all own" on public.products;
create policy "products: all own" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists products_user_id_idx on public.products(user_id);

-- 2) Plantillas de presupuesto (snapshot en JSON) ------------
create table if not exists public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.budget_templates enable row level security;
drop policy if exists "templates: all own" on public.budget_templates;
create policy "templates: all own" on public.budget_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists templates_user_id_idx on public.budget_templates(user_id);

-- 3) Enlace público + seguimiento en budgets -----------------
alter table public.budgets add column if not exists public_token uuid not null default gen_random_uuid();
alter table public.budgets add column if not exists viewed_at timestamptz;
alter table public.budgets add column if not exists accepted_at timestamptz;
alter table public.budgets add column if not exists rejected_at timestamptz;
create unique index if not exists budgets_public_token_idx on public.budgets(public_token);

-- 4) Marca / numeración personalizada en profiles ------------
alter table public.profiles add column if not exists brand_color text default '#2F6BFF';
alter table public.profiles add column if not exists number_prefix text default 'PRES';
alter table public.profiles add column if not exists hide_branding boolean not null default false;

-- 5) RPC pública: leer presupuesto por token (bypassa RLS de forma segura)
--    Solo devuelve la fila cuyo token secreto coincide. Marca 'visto'.
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

  if b.viewed_at is null then
    update public.budgets
      set viewed_at = now(),
          status = case when status = 'enviado' then 'visto' else status end
      where id = b.id;
    select * into b from public.budgets where id = b.id;
  end if;

  return jsonb_build_object(
    'budget', to_jsonb(b) - 'user_id',
    'items', coalesce(
      (select jsonb_agg(to_jsonb(i) order by i.position) from public.budget_items i where i.budget_id = b.id),
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

-- 6) RPC pública: aceptar / rechazar por token ---------------
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

  update public.budgets
    set status = p_action,
        accepted_at = case when p_action = 'aceptado' then now() else accepted_at end,
        rejected_at = case when p_action = 'rechazado' then now() else rejected_at end
    where public_token = p_token
    returning * into b;

  if not found then
    return null;
  end if;

  return jsonb_build_object('ok', true, 'status', b.status);
end;
$$;

grant execute on function public.get_public_budget(uuid) to anon, authenticated;
grant execute on function public.set_budget_response(uuid, text) to anon, authenticated;

-- ============================================================
-- Fin de la migración 03
-- ============================================================
