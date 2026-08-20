-- ============================================================
-- CATI / NUMERA · Migración 19 · RUBRO DEL NEGOCIO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ AGREGA
--   Un campo `rubro` en el perfil (construcción, oficios, servicios,
--   comercio, gastronomía, automotor u «otro»). Se elige al crear la
--   cuenta y se puede cambiar en «Mi negocio».
--
--   Con eso, un presupuesto nuevo arranca con las condiciones, las
--   formas de pago y la validez que se usan en ese rubro, en vez de
--   nacer vacío. Es solo un punto de partida: lo que el usuario haya
--   escrito en «Mi negocio» siempre gana, y los textos sugeridos se
--   pueden editar en cada presupuesto.
--
--   No cambia permisos, ni planes, ni esconde funciones.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columna nueva en profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists rubro text default '';

-- ------------------------------------------------------------
-- 2) Permiso de escritura a nivel columna
--    (la migración 07 revocó el UPDATE general sobre profiles: un
--     campo nuevo no es editable hasta que se lo agrega acá)
-- ------------------------------------------------------------
grant update (rubro) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3) El rubro elegido en el registro llega al perfil
--    El perfil lo crea la base (no el navegador), así que hay que
--    copiar el dato desde los metadatos del alta. Es la misma
--    función de la migración 07 con una línea más; el resto queda
--    igual, incluida la prueba de 72 h.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, business_name, rubro, plan, trial_ends_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'business_name', ''),
    coalesce(new.raw_user_meta_data->>'rubro', ''),
    'free',
    now() + interval '72 hours'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4) Verificación
-- ------------------------------------------------------------
-- a) La columna existe y es editable:
--      select column_name from information_schema.columns
--       where table_name = 'profiles' and column_name = 'rubro';
--
-- b) Cuántos usuarios hay por rubro (los de antes quedan en ''):
--      select coalesce(nullif(rubro, ''), 'sin declarar') as rubro,
--             count(*)
--        from public.profiles group by 1 order by 2 desc;
--
-- c) Creá una cuenta de prueba eligiendo rubro y revisá que llegó:
--      select business_name, rubro from public.profiles
--       order by created_at desc limit 3;

-- ============================================================
-- Fin de la migración 19
-- ============================================================
