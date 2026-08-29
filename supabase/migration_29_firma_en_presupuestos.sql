-- ============================================================
-- CATI / NUMERA · Migración 29 · FIRMA Y ACLARACIÓN EN LOS PRESUPUESTOS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ CAMBIA
--   El presupuesto ahora puede salir ya firmado, igual que el acuerdo de
--   confidencialidad. La firma es la misma que ya guarda el perfil
--   (firma_png, migración 27): esto solo agrega el nombre que va debajo
--   de la raya, la aclaración.
--
--   Hasta ahora ahí decía el nombre del NEGOCIO, que no siempre es el de
--   la persona que firma ("Estudio Martínez" no es una persona). Con esta
--   columna se puede poner el nombre y apellido de quien firma, y el
--   nombre del negocio queda abajo, donde corresponde.
--
--   Va con un segundo campo, firma_cargo, para el "CEO y Desarrollador
--   de sTuDiob2b" que va abajo del nombre. Solo del lado del emisor: el
--   renglón del cliente no lleva ni nombre ni cargo, lo escribe él.
--
--   Si las dejás vacías, el presupuesto sale como salía antes.
--
-- ⚠ Se puede correr dos veces sin miedo (add column if not exists +
--   grant): si ya corriste una versión anterior de esta migración,
--   volvé a correrla entera y listo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) La columna
--    Opcional. No es un dato sensible como la firma: es el nombre que
--    el propio usuario quiere que se lea en el papel.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists firma_nombre text;
alter table public.profiles add column if not exists firma_cargo text;

-- ------------------------------------------------------------
-- 2) Permiso de escritura
--    Los GRANT de profiles son columna por columna (migración 07): sin
--    esta línea la app guarda todo lo demás y falla solo en este campo.
-- ------------------------------------------------------------
grant update (firma_nombre, firma_cargo) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3) Lo que NO cambia, a propósito
--    Los RPC públicos (get_public_budget, get_public_nda) arman el
--    objeto `business` campo por campo. No se toca ninguno: la firma
--    (firma_png) sigue sin salir por un link compartido, y el
--    presupuesto firmado lo genera el dueño en su propia máquina.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4) Verificación
--      select column_name from information_schema.columns
--       where table_name = 'profiles'
--         and column_name in ('firma_nombre', 'firma_cargo');
--    → tienen que salir las dos filas
-- ------------------------------------------------------------

-- ============================================================
-- Fin de la migración 29
-- ============================================================
