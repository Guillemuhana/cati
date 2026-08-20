-- ============================================================
-- CATI / NUMERA · Migración 20 · IMÁGENES EN EL PRESUPUESTO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ AGREGA
--   Cada presupuesto puede llevar hasta 4 imágenes (foto del trabajo,
--   un plano, una referencia). Es opcional: si no subís nada, el
--   presupuesto sale exactamente igual que hoy.
--   Aparecen en el PDF y en el enlace público.
--
--   Se guardan en un bucket nuevo `adjuntos`, con las mismas reglas
--   que `logos`: cada usuario solo escribe dentro de su carpeta, y la
--   lectura es pública porque la imagen tiene que poder verse desde
--   el PDF y desde el link que abre el cliente.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columna nueva en budgets
--    Un array JSON de URLs: ["https://...jpg", ...]
--    El enlace público devuelve to_jsonb(budget), así que este campo
--    viaja solo: no hay que tocar get_public_budget.
-- ------------------------------------------------------------
alter table public.budgets
  add column if not exists images jsonb not null default '[]'::jsonb;

-- Un presupuesto no es un álbum: tope duro de 4, y solo arrays.
alter table public.budgets drop constraint if exists budgets_images_check;
alter table public.budgets add constraint budgets_images_check
  check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 4);

-- ------------------------------------------------------------
-- 2) Bucket de adjuntos
--    Público para leer (el cliente abre el link sin cuenta), pero
--    con límite de tamaño y de tipos: sin esto se sube un .exe de
--    200 MB a tu Storage.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', true)
on conflict (id) do nothing;

update storage.buckets
   set file_size_limit    = 5242880,  -- 5 MB
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'adjuntos';

-- ------------------------------------------------------------
-- 3) Policies del bucket (mismo patrón que `logos`)
--    La primera carpeta del path tiene que ser el id del usuario:
--    <user_id>/presupuestos/<uuid>.jpg
-- ------------------------------------------------------------
drop policy if exists "adjuntos: lectura pública"    on storage.objects;
drop policy if exists "adjuntos: subida propia"      on storage.objects;
drop policy if exists "adjuntos: actualización propia" on storage.objects;
drop policy if exists "adjuntos: borrado propio"     on storage.objects;

create policy "adjuntos: lectura pública"
  on storage.objects for select
  using (bucket_id = 'adjuntos');

create policy "adjuntos: subida propia"
  on storage.objects for insert
  with check (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "adjuntos: actualización propia"
  on storage.objects for update
  using (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "adjuntos: borrado propio"
  on storage.objects for delete
  using (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ------------------------------------------------------------
-- 4) Verificación
-- ------------------------------------------------------------
-- a) Columna y tope:
--      select images from public.budgets limit 1;               -- []
--      update public.budgets set images = '["a","b","c","d","e"]'::jsonb
--       where id = (select id from public.budgets limit 1);      -- debe FALLAR
--
-- b) Bucket con límites:
--      select id, public, file_size_limit, allowed_mime_types
--        from storage.buckets where id = 'adjuntos';
--
-- c) Subí una imagen desde un presupuesto y revisá que se vea en el
--    PDF y en el enlace público.

-- ============================================================
-- Fin de la migración 20
-- ============================================================
