-- ============================================================
-- CATI / NUMERA · Migración 33 · PLANTILLA DEL PDF
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   El presupuesto de un gasista salía en la misma hoja en blanco que
--   el de un contador. Ahora hay un catálogo de plantillas —una imagen
--   de fondo y un color de títulos— y cada uno elige la suya en Mi
--   negocio. Esta columna es lo único que hay que guardar.
--
-- POR QUÉ SOLO UNA COLUMNA DE TEXTO
--   Las imágenes las diseñamos nosotros y viven en el repo
--   (public/plantillas/), no en la base ni en Storage: no hay subida de
--   archivos, así que acá alcanza con anotar CUÁL eligió. El catálogo
--   entero está en src/lib/plantillas.js.
--
--   El COLOR tampoco se guarda acá. El perfil ya tiene brand_color, que
--   es lo único que mira el PDF; elegir una plantilla escribe su color
--   en ese campo, a la vista y editable. Dos columnas de color habrían
--   sido dos fuentes de verdad peleándose a la hora de dibujar.
--
-- EL NULL SIGNIFICA ALGO
--   null  = todavía no eligió → sale la plantilla que le toca al rubro.
--   ''    = eligió la hoja en blanco, a propósito.
--   'gasista' = eligió esa.
--
--   Por eso la columna NO tiene default '': ese default convertiría a
--   todos los que ya existen en «eligieron hoja en blanco» y ninguno
--   vería nunca la plantilla de su rubro.
-- ============================================================

-- ------------------------------------------------------------
-- 1) La columna
-- ------------------------------------------------------------
alter table public.profiles add column if not exists plantilla_pdf text;

comment on column public.profiles.plantilla_pdf is
  'Key de la plantilla de hoja del PDF (src/lib/plantillas.js). '
  'null = no eligió todavía y sale la del rubro; '''' = hoja en blanco.';

-- ------------------------------------------------------------
-- 2) Que no entre cualquier cosa
--    La key se dibuja como ruta de imagen en el PDF, así que se acepta
--    solo lo que parece una key nuestra: letras, números y guiones.
--    Sin esto alguien podría escribir '../../loquesea' en su perfil.
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_plantilla_pdf_check;
alter table public.profiles add constraint profiles_plantilla_pdf_check
  check (plantilla_pdf is null or plantilla_pdf ~ '^[a-z0-9-]{0,40}$');

-- ------------------------------------------------------------
-- 3) Lo que NO se toca, a propósito
--    El RPC público (get_public_budget) queda como está. La página que
--    abre el cliente es HTML, no un PDF armado en su navegador: el
--    fondo no se dibuja ahí, así que mandarle la plantilla por el
--    enlace no le serviría de nada. Y redefinir esa función para
--    agregar un campo que nadie lee es la clase de cambio que rompe un
--    enlace compartido sin que nadie se entere hasta que un cliente
--    escribe.
--
--    Si algún día la página pública imita la hoja, ahí sí hay que
--    sumar 'plantilla_pdf' y 'rubro' al bloque 'business'.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4) Verificación
--    a) La columna existe:
--         select column_name from information_schema.columns
--          where table_name = 'profiles' and column_name = 'plantilla_pdf';
--
--    b) Lo bueno pasa:
--         update public.profiles set plantilla_pdf = 'gasista'
--          where id = auth.uid();
--
--    c) Una ruta NO pasa:
--         update public.profiles set plantilla_pdf = '../../etc'
--          where id = auth.uid();
--       → tiene que FALLAR por profiles_plantilla_pdf_check.
--
-- ============================================================
-- Fin de la migración 33
-- ============================================================
