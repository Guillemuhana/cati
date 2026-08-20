-- ============================================================
-- CATI / NUMERA · Migración 18 · SIN BORRADORES + LOGO DEL CLIENTE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ CAMBIA
--   1. Todo presupuesto nuevo nace en estado 'enviado'. El estado
--      'borrador' confundía (parecía que faltaba algo) y se sacó de
--      la app: ya no aparece en el formulario ni en los filtros.
--   2. Los clientes pueden tener su propio logo (clients.logo_url),
--      igual que "Mi negocio". Se guarda en el bucket `logos` que ya
--      existe, dentro de la carpeta del usuario.
--
-- ⚠ LEER EL PUNTO 2 DE ABAJO: convierte los borradores que ya tenés.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nuevo default del estado
--    El check sigue aceptando 'borrador' para no romper lo viejo.
-- ------------------------------------------------------------
alter table public.budgets alter column status set default 'enviado';

-- ------------------------------------------------------------
-- 2) Pasar los borradores existentes a 'enviado'
--    Si preferís conservarlos como están, comentá esta línea antes
--    de ejecutar la migración: la app los sigue mostrando bien
--    (el cartel dice "Borrador"), solo que ya no vas a poder
--    filtrarlos ni volver a poner ese estado a mano.
-- ------------------------------------------------------------
update public.budgets set status = 'enviado' where status = 'borrador';

-- ------------------------------------------------------------
-- 3) Logo del cliente
--    Columna nueva, opcional. La imagen vive en el bucket público
--    `logos` (creado en schema.sql), bajo <user_id>/clientes/<uuid>.
--    Las policies de storage ya exigen que la primera carpeta sea el
--    id del usuario, así que no hace falta tocar nada más.
-- ------------------------------------------------------------
alter table public.clients add column if not exists logo_url text;

-- ------------------------------------------------------------
-- 4) Verificación
-- ------------------------------------------------------------
-- a) Default nuevo:
--      select column_default from information_schema.columns
--       where table_name = 'budgets' and column_name = 'status';
--    → tiene que decir 'enviado'::text
--
-- b) No quedan borradores:
--      select status, count(*) from public.budgets group by status;
--
-- c) Columna del logo:
--      select column_name from information_schema.columns
--       where table_name = 'clients' and column_name = 'logo_url';

-- ============================================================
-- Fin de la migración 18
-- ============================================================
