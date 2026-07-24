-- ============================================================
-- CATI · Migración 05 · Suscripción mensual (USD 2 / mes)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura.
-- ============================================================

-- Hasta cuándo está paga la suscripción (se renueva cada mes).
alter table public.profiles add column if not exists premium_until timestamptz;

-- ============================================================
-- ACTIVAR / RENOVAR la suscripción de un usuario que pagó (beta):
--   update public.profiles
--     set plan = 'premium',
--         premium_since = coalesce(premium_since, now()),
--         premium_until = greatest(coalesce(premium_until, now()), now()) + interval '1 month'
--     where email = 'cliente@ejemplo.com';
--
-- DAR DE BAJA (al vencer o cancelar):
--   update public.profiles set plan = 'free' where email = 'cliente@ejemplo.com';
-- ============================================================
-- Fin de la migración 05
-- ============================================================
