-- ============================================================
-- CATI / NUMERA · Migración 21 · SEGURIDAD DE LOS ADJUNTOS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la migración 20 corrida antes.
--
-- Sale de la revisión previa a producción. Arregla dos cosas:
--
--   1. CUALQUIERA PUEDE LISTAR EL STORAGE.
--      Comprobado contra el proyecto real con la anon key (la misma
--      que viaja en el navegador de cualquier visitante):
--          supabase.storage.from('logos').list('')
--        → devuelve las carpetas, que son los user_id de tus usuarios
--          supabase.storage.from('logos').list('<user_id>')
--        → devuelve 'logo.png', y con eso se arma la URL pública
--      Con los logos el daño es bajo. Con `adjuntos` no: ahí hay fotos
--      de trabajos y de casas de clientes, y se podrían recorrer todas.
--      La causa es la policy "lectura pública", que da SELECT sobre
--      todo el bucket. No hace falta: los buckets públicos sirven el
--      archivo por su URL sin pasar por RLS. La policy solo habilita
--      el LISTADO por API, que es justo lo que no queremos.
--
--   2. LA URL DE UNA IMAGEN NO SE VALIDA.
--      `budgets.images` lo escribe el dueño del presupuesto, y no solo
--      desde el formulario: con su token puede mandar cualquier texto
--      por la API. Un 'javascript:...' ahí termina dentro de un <a>
--      del enlace público, en nuestro dominio, en el navegador del
--      cliente que abre el link. Se valida en el navegador y acá.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Que no se pueda listar el contenido de los buckets
--    Se reemplaza el SELECT abierto por uno de dueño: cada usuario
--    ve por API solo lo suyo. El público sigue viendo las imágenes
--    por su URL, que es como las abre el PDF y el enlace del cliente.
-- ------------------------------------------------------------
drop policy if exists "logos: lectura pública"    on storage.objects;
drop policy if exists "adjuntos: lectura pública" on storage.objects;

create policy "logos: lectura propia"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "adjuntos: lectura propia"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'adjuntos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ⚠ PROBALO APENAS LA CORRAS (2 minutos):
--     · Abrí un presupuesto compartido (/p/<token>) en una ventana de
--       incógnito: el logo y las imágenes TIENEN que verse igual.
--     · Descargá el PDF: el logo tiene que estar.
--   Si algo no se ve, volvé atrás con esto y avisá:
--       drop policy if exists "logos: lectura propia" on storage.objects;
--       create policy "logos: lectura pública"
--         on storage.objects for select using (bucket_id = 'logos');
--       drop policy if exists "adjuntos: lectura propia" on storage.objects;
--       create policy "adjuntos: lectura pública"
--         on storage.objects for select using (bucket_id = 'adjuntos');

-- ------------------------------------------------------------
-- 2) Validar las URLs de las imágenes en la base
--    Solo https del Storage de Supabase, que es el único lugar del
--    que salen. Reemplaza al check de la migración 20.
-- ------------------------------------------------------------
create or replace function public.images_ok(imgs jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  u text;
begin
  if imgs is null then
    return true;
  end if;
  if jsonb_typeof(imgs) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(imgs) > 4 then
    return false;
  end if;
  for u in select jsonb_array_elements_text(imgs) loop
    if u !~ '^https://[a-z0-9-]+\.supabase\.co/' then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.budgets drop constraint if exists budgets_images_check;
alter table public.budgets add constraint budgets_images_check
  check (public.images_ok(images));

-- ------------------------------------------------------------
-- 3) Verificación
-- ------------------------------------------------------------
-- a) Ya no se puede listar (en la consola del navegador, sin loguear):
--      await supabase.storage.from('adjuntos').list('')
--    → tiene que venir vacío o con error, no con la lista de usuarios.
--
-- b) La validación de URLs muerde:
--      update public.budgets set images = '["javascript:alert(1)"]'::jsonb
--       where id = (select id from public.budgets limit 1);
--    → tiene que FALLAR por budgets_images_check.
--
-- c) Y lo bueno sigue pasando:
--      update public.budgets
--         set images = '["https://x.supabase.co/storage/v1/object/public/adjuntos/a.jpg"]'::jsonb
--       where id = (select id from public.budgets limit 1);
--    → tiene que funcionar. (Después dejalo como estaba.)

-- ============================================================
-- Fin de la migración 21
-- ============================================================
