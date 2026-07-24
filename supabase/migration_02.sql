-- ============================================================
-- CATI · Migración 02 · Mejoras de "Nuevo presupuesto"
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Es aditiva y segura: no borra datos existentes.
-- ============================================================

-- 1) Nuevas columnas en budgets ------------------------------
alter table public.budgets add column if not exists reference text default '';
alter table public.budgets add column if not exists deposit numeric not null default 0;
alter table public.budgets add column if not exists payment_terms text default '';
alter table public.budgets add column if not exists payment_methods text default '';
alter table public.budgets add column if not exists delivery_time text default '';

-- 2) Ampliar estados permitidos (mantiene los existentes) ----
--    Añade 'visto' y 'aceptado' sin romper 'aprobado' ya guardado.
alter table public.budgets drop constraint if exists budgets_status_check;
alter table public.budgets add constraint budgets_status_check
  check (status in ('borrador','enviado','visto','aprobado','aceptado','rechazado','vencido'));

-- 3) Defaults comerciales en profiles (para "Mi negocio") -----
alter table public.profiles add column if not exists default_payment_terms text default '';
alter table public.profiles add column if not exists default_payment_methods text default '';
alter table public.profiles add column if not exists bank_alias text default '';

-- ============================================================
-- Fin de la migración 02
-- ============================================================
