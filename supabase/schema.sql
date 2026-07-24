-- ============================================================
-- CATI · Esquema de base de datos para Supabase (Postgres)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) profiles: datos del negocio de cada usuario
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  email text,
  phone text,
  tax_id text,
  address text,
  logo_url text,
  currency text not null default 'ARS',
  default_terms text default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- ------------------------------------------------------------
-- 2) clients: clientes de cada usuario
-- ------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  tax_id text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "clients: select own" on public.clients
  for select using (auth.uid() = user_id);
create policy "clients: insert own" on public.clients
  for insert with check (auth.uid() = user_id);
create policy "clients: update own" on public.clients
  for update using (auth.uid() = user_id);
create policy "clients: delete own" on public.clients
  for delete using (auth.uid() = user_id);

create index if not exists clients_user_id_idx on public.clients(user_id);

-- ------------------------------------------------------------
-- 3) budgets: presupuestos
-- ------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  numero integer not null default 1,
  title text default '',
  status text not null default 'borrador'
    check (status in ('borrador','enviado','aprobado','rechazado','vencido')),
  issue_date date not null default current_date,
  due_date date,
  currency text not null default 'ARS',
  discount_type text not null default 'none' check (discount_type in ('none','percent','fixed')),
  discount_value numeric not null default 0,
  tax_rate numeric not null default 0,
  notes text default '',
  terms text default '',
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

create policy "budgets: select own" on public.budgets
  for select using (auth.uid() = user_id);
create policy "budgets: insert own" on public.budgets
  for insert with check (auth.uid() = user_id);
create policy "budgets: update own" on public.budgets
  for update using (auth.uid() = user_id);
create policy "budgets: delete own" on public.budgets
  for delete using (auth.uid() = user_id);

create index if not exists budgets_user_id_idx on public.budgets(user_id);
create index if not exists budgets_client_id_idx on public.budgets(client_id);

-- ------------------------------------------------------------
-- 4) budget_items: ítems de cada presupuesto
-- ------------------------------------------------------------
create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  position integer not null default 0
);

alter table public.budget_items enable row level security;

create policy "budget_items: select own" on public.budget_items
  for select using (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  );
create policy "budget_items: insert own" on public.budget_items
  for insert with check (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  );
create policy "budget_items: update own" on public.budget_items
  for update using (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  );
create policy "budget_items: delete own" on public.budget_items
  for delete using (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  );

create index if not exists budget_items_budget_id_idx on public.budget_items(budget_id);

-- ------------------------------------------------------------
-- 5) Storage: bucket público para logos de negocio
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create policy "logos: lectura pública"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "logos: subida propia"
  on storage.objects for insert
  with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "logos: actualización propia"
  on storage.objects for update
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "logos: borrado propio"
  on storage.objects for delete
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Fin del esquema
-- ============================================================
