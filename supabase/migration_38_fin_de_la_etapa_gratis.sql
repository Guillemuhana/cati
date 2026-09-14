-- ============================================================
-- CATI / NUMERA · Migración 38 · TERMINA LA ETAPA GRATIS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ CAMBIA
--   La etapa en la que todo estaba abierto para todos terminaba el
--   1/11/2026. Pasa a terminar el 14/09/2026, o sea hoy.
--
-- A QUIÉN AFECTA HOY: A NADIE
--   Suena peor de lo que es. Cuando se armó la promo (migración 11), a
--   todos los registrados se les puso trial_ends_at = 1/11/2026, y el
--   trigger de alta siguió haciendo lo mismo con cada uno que llegó
--   después. is_premium() mira el trial además de la etapa gratis, así
--   que los que ya están siguen con todo abierto hasta el 1 de
--   noviembre, que es la fecha con la que se registraron.
--
--   Lo que cambia hoy es para adelante: el que se registra de ahora en
--   más tiene los 3 días de la migración 35, y la app empieza a
--   mostrar los precios y el botón de pagar en vez de decir que está
--   todo gratis.
--
--   ANTES DE CORRER ESTO conviene mirar que sea cierto en tu base:
--
--     select count(*) from public.profiles
--      where plan <> 'premium'
--        and (trial_ends_at is null or trial_ends_at <= now());
--
--   Tiene que dar 0. Si da más, esos usuarios se quedan sin el enlace
--   público en el momento en que corras esta migración, y sus clientes
--   dejan de poder abrir presupuestos que ya recibieron por WhatsApp.
--   En ese caso, primero dales aire:
--
--     update public.profiles
--        set trial_ends_at = now() + interval '30 days'
--      where plan <> 'premium'
--        and (trial_ends_at is null or trial_ends_at <= now());
--
-- LA FECHA ESTÁ ESCRITA DOS VECES
--   Acá para el servidor y en src/lib/config.js para el navegador. Si
--   se mueve una, hay que mover la otra. El servidor es el que manda:
--   cambiar solo la del navegador dejaría la app cerrada pero la API
--   regalando todo a quien sepa abrir la pestaña Network.
-- ============================================================

create or replace function public.free_until()
returns timestamptz
language sql
immutable
as $$
  select timestamptz '2026-09-14 00:00:00-03';
$$;

grant execute on function public.free_until() to authenticated, anon, service_role;

-- ------------------------------------------------------------
-- Verificación
--   a) La fecha quedó:
--        select public.free_until();
--      → 2026-09-14 00:00:00-03
--
--   b) Nadie perdió el acceso de golpe:
--        select count(*) from public.profiles
--         where plan <> 'premium'
--           and (trial_ends_at is null or trial_ends_at <= now());
--      → tiene que seguir dando 0.
--
--   c) Un usuario cualquiera sigue siendo premium por su prueba:
--        select public.is_premium(id), trial_ends_at
--          from public.profiles
--         where plan <> 'premium'
--         limit 5;
--      → true, con la fecha de su prueba.
-- ============================================================
-- Fin de la migración 38
-- ============================================================
