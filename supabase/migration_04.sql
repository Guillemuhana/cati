-- ============================================================
-- CATI · Migración 04 · Prueba de 72 h + plan premium
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos existentes.
-- ============================================================

-- Plan del usuario: 'free' | 'premium'
alter table public.profiles add column if not exists plan text not null default 'free';

-- Fin de la prueba gratuita (todas las funciones premium hasta esta fecha)
alter table public.profiles add column if not exists trial_ends_at timestamptz;

-- Cuándo pasó a premium (informativo)
alter table public.profiles add column if not exists premium_since timestamptz;

-- Backfill: a los usuarios existentes se les da una prueba fresca de 72 h.
update public.profiles
  set trial_ends_at = now() + interval '72 hours'
  where trial_ends_at is null;

-- ============================================================
-- Para ACTIVAR premium a un usuario que pagó (durante la beta):
--   update public.profiles
--     set plan = 'premium', premium_since = now()
--     where email = 'cliente@ejemplo.com';
-- ============================================================
-- Fin de la migración 04
-- ============================================================
