-- ============================================================
-- CATI / NUMERA · Migración 25 · TU PROPIO PDF EN EL PRESUPUESTO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere las migraciones 20 y 21 corridas antes.
--
-- QUÉ AGREGA
--   Un presupuesto puede llevar un PDF hecho por el usuario.
--
--   Hay rubros donde la propuesta NO es una lista de ítems: un
--   fotógrafo manda un PDF con la selección de fotos, los packs y las
--   opciones, ya diseñado. Hasta hoy la única salida era mandarlo por
--   fuera de la app, y el cliente recibía dos cosas sueltas.
--
--   Con esto lo sube acá: el PDF viaja con el presupuesto, sale en el
--   enlace que abre el cliente y es lo primero que se ofrece al
--   compartir. El presupuesto generado por Numera sigue existiendo:
--   este PDF se suma, no reemplaza nada.
--
-- QUÉ TOCA DEL BUCKET
--   `adjuntos` hoy solo acepta imágenes y hasta 5 MB. Un PDF con fotos
--   adentro pasa los 5 MB sin esfuerzo, así que el tope sube a 15 MB y
--   se agrega el tipo application/pdf. El navegador igual sigue
--   frenando las imágenes en 5 MB (ver BudgetImages.jsx): el límite del
--   bucket es la red de contención, no el límite de uso.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Freno: sin la 20 no existe ni la columna images ni el bucket.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'budgets'
       and column_name  = 'images'
  ) then
    raise exception
      'Falta la migración 20. Corré primero supabase/migration_20_imagenes_presupuesto.sql.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 1) Columna nueva
--    El enlace público devuelve to_jsonb(budget), así que este campo
--    viaja solo: no hay que tocar get_public_budget.
-- ------------------------------------------------------------
alter table public.budgets
  add column if not exists pdf_url text;

-- ------------------------------------------------------------
-- 2) Validar la URL, igual que con las imágenes (migración 21)
--    Esto lo escribe el dueño del presupuesto, y no solo desde el
--    formulario: con su token puede mandar cualquier texto por la API.
--    Un 'javascript:...' acá termina dentro de un <a> del enlace
--    público, en nuestro dominio, en el navegador de su cliente.
-- ------------------------------------------------------------
alter table public.budgets drop constraint if exists budgets_pdf_url_check;
alter table public.budgets add constraint budgets_pdf_url_check
  check (pdf_url is null or pdf_url ~ '^https://[a-z0-9-]+\.supabase\.co/');

-- ------------------------------------------------------------
-- 3) El bucket acepta PDF, y sube el tope a 15 MB
-- ------------------------------------------------------------
update storage.buckets
   set file_size_limit    = 15728640,  -- 15 MB
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
 where id = 'adjuntos';

-- ------------------------------------------------------------
-- 4) Verificación
-- ------------------------------------------------------------
-- a) La columna existe y arranca vacía:
--      select pdf_url from public.budgets limit 1;              -- null
--
-- b) La validación muerde:
--      update public.budgets set pdf_url = 'javascript:alert(1)'
--       where id = (select id from public.budgets limit 1);
--    → tiene que FALLAR por budgets_pdf_url_check.
--
-- c) El bucket quedó como esperamos:
--      select id, file_size_limit, allowed_mime_types
--        from storage.buckets where id = 'adjuntos';
--
-- d) Y la prueba de verdad: subí un PDF desde un presupuesto, abrí el
--    enlace público en una ventana de incógnito y fijate que se abra.

-- ============================================================
-- Fin de la migración 25
-- ============================================================
