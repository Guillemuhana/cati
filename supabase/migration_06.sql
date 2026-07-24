-- ============================================================
-- CATI · Migración 06 · Comprobantes (facturas no fiscales) y recibos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura. Documentos NO fiscales (uso administrativo).
-- ============================================================

-- 1) Facturas / comprobantes (snapshot de ítems en JSON) -----
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid references public.budgets(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  numero integer not null default 1,
  issue_date date not null default current_date,
  currency text not null default 'ARS',
  reference text default '',
  discount_type text not null default 'none',
  discount_value numeric not null default 0,
  tax_rate numeric not null default 0,
  deposit numeric not null default 0,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  paid_amount numeric not null default 0,
  status text not null default 'emitida' check (status in ('emitida','pagada','anulada')),
  notes text default '',
  terms text default '',
  payment_terms text default '',
  payment_methods text default '',
  delivery_time text default '',
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
drop policy if exists "invoices: all own" on public.invoices;
create policy "invoices: all own" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists invoices_user_id_idx on public.invoices(user_id);

-- 2) Recibos de pago / seña ----------------------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  numero integer not null default 1,
  receipt_date date not null default current_date,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  method text default '',
  concept text default '',
  created_at timestamptz not null default now()
);
alter table public.receipts enable row level security;
drop policy if exists "receipts: all own" on public.receipts;
create policy "receipts: all own" on public.receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists receipts_user_id_idx on public.receipts(user_id);
create index if not exists receipts_invoice_id_idx on public.receipts(invoice_id);

-- ============================================================
-- Fin de la migración 06
-- ============================================================
