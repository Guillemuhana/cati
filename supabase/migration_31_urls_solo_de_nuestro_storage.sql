-- ============================================================
-- CATI / NUMERA · Migración 31 · LAS URLs, SOLO DE NUESTRO STORAGE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   Las migraciones 20, 21 y 25 exigen que las imágenes y el PDF propio
--   vengan de «una URL de Supabase». El agujero es la palabra «una»:
--
--     ^https://[a-z0-9-]+\.supabase\.co/
--
--   Ese patrón acepta CUALQUIER proyecto de Supabase, no el nuestro.
--   Supabase lo puede crear cualquiera gratis en dos minutos.
--
--   Con eso, un usuario de Numera puede guardar en su presupuesto un
--   pdf_url apuntando a un archivo suyo en un proyecto propio, y ese
--   enlace después se dibuja en la página pública /p/<token>, que se
--   sirve desde NUESTRO dominio. El cliente que abre el presupuesto ve
--   un botón «Ver la propuesta en PDF» con la marca del emisor, en un
--   dominio en el que confía, que baja lo que quiera el atacante. Es
--   phishing con nuestra credibilidad prestada.
--
--   La app ya no dibuja esas URLs (src/lib/utils.js quedó atado al
--   proyecto de verdad), pero la base tiene que decir lo mismo: si
--   mañana alguien escribe por la API, el candado que manda es este.
--
-- ⚠ ESTA MIGRACIÓN LLEVA EL NOMBRE DEL PROYECTO ADENTRO
--   Si algún día se muda el proyecto de Supabase, hay que cambiar la
--   constante de abajo y volver a correrla. No es un dato secreto: viaja
--   en el javascript que recibe cualquier visitante.
-- ============================================================

-- ------------------------------------------------------------
-- 1) De dónde tienen que salir los archivos
--    Una función sola, para no repetir el patrón en cinco lugares y que
--    después se corrija en cuatro.
-- ------------------------------------------------------------
create or replace function public.url_de_nuestro_storage(u text)
returns boolean
language sql
immutable
as $$
  select u is not null
     and u like 'https://hzkfqbccayoooteqyfeu.supabase.co/storage/v1/object/public/%';
$$;

comment on function public.url_de_nuestro_storage(text) is
  'True solo si la URL es un objeto público del Storage de ESTE proyecto. '
  'El host va escrito entero a propósito: con [a-z0-9-]+.supabase.co entra '
  'el proyecto de cualquiera.';

-- ------------------------------------------------------------
-- 2) Las imágenes del presupuesto
--    Reemplaza la versión de la migración 21.
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
    if not public.url_de_nuestro_storage(u) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- ------------------------------------------------------------
-- 3) El PDF propio del presupuesto
--    Reemplaza el check de la migración 25.
-- ------------------------------------------------------------
alter table public.budgets drop constraint if exists budgets_pdf_url_check;
alter table public.budgets add constraint budgets_pdf_url_check
  check (pdf_url is null or public.url_de_nuestro_storage(pdf_url));

-- ------------------------------------------------------------
-- 4) Los logos
--    El del negocio y el del cliente (migración 18) nunca habían tenido
--    check. El del negocio sale en la vista previa del enlace, que la ve
--    cualquiera en el grupo de WhatsApp donde se pegó.
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_logo_url_check;
alter table public.profiles add constraint profiles_logo_url_check
  check (logo_url is null or public.url_de_nuestro_storage(logo_url));

alter table public.clients drop constraint if exists clients_logo_url_check;
alter table public.clients add constraint clients_logo_url_check
  check (logo_url is null or public.url_de_nuestro_storage(logo_url));

-- ------------------------------------------------------------
-- 5) Si algo de lo que ya está guardado no pasa el check
--    Los ALTER de arriba fallan si hay una fila vieja que no cumple. No
--    se borra nada a ciegas: primero mirá qué es.
--
--      select id, logo_url from public.profiles
--       where logo_url is not null
--         and not public.url_de_nuestro_storage(logo_url);
--
--      select id, logo_url from public.clients
--       where logo_url is not null
--         and not public.url_de_nuestro_storage(logo_url);
--
--      select id, pdf_url from public.budgets
--       where pdf_url is not null
--         and not public.url_de_nuestro_storage(pdf_url);
--
--    Lo normal es que salgan URLs con `?t=1234` al final (el
--    rompe-caché que pone la app al subir un logo): esas SÍ pasan, el
--    patrón termina en %. Si aparece otra cosa, es justamente lo que
--    esta migración vino a sacar: poné ese campo en null y volvé a
--    correr el ALTER.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 6) Verificación
--    a) Lo bueno pasa:
--         select public.url_de_nuestro_storage(
--           'https://hzkfqbccayoooteqyfeu.supabase.co/storage/v1/object/public/logos/x.png');
--       → true
--
--    b) El proyecto de otro NO pasa (esto es lo que arregla la migración):
--         select public.url_de_nuestro_storage(
--           'https://proyecto-de-otro.supabase.co/storage/v1/object/public/logos/x.png');
--       → false
--
--    c) Y el check muerde de verdad:
--         update public.budgets
--            set pdf_url = 'https://proyecto-de-otro.supabase.co/storage/v1/object/public/a.pdf'
--          where id = (select id from public.budgets limit 1);
--       → tiene que FALLAR por budgets_pdf_url_check.
-- ------------------------------------------------------------

-- ============================================================
-- Fin de la migración 31
-- ============================================================
