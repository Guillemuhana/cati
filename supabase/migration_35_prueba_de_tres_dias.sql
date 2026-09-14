-- ============================================================
-- CATI / NUMERA · Migración 35 · LA PRUEBA PASA A TRES DÍAS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   La prueba para el que se registra queda en 3 días con todo
--   incluido. Venía de 30 (migración 11) y de 7 (migración 34).
--
-- SI TODAVÍA NO CORRISTE LA 34
--   Corré esta sola y listo: las dos redefinen la misma función, así
--   que esta la reemplaza entera. No hace falta correr la 34 primero
--   ni correrlas en orden.
--
-- POR QUÉ ACÁ Y NO SOLO EN EL CÓDIGO
--   La fecha de fin de prueba la escribe handle_new_user, que corre en
--   la base al crear el usuario. TRIAL_DAYS de src/lib/config.js solo
--   alimenta los carteles: si se cambiara nada más que ahí, la app
--   diría 3 días y la base seguiría dando 7.
--
-- A QUIÉN AFECTA
--   Solo a los que se registren DE ACÁ EN ADELANTE. A nadie se le
--   recorta una prueba ya empezada.
--
--   Mientras siga la etapa gratis para todos (hasta el 1/11/2026) esto
--   no se nota: el trial de los nuevos se sigue fijando en esa fecha.
-- ============================================================

-- ------------------------------------------------------------
-- 1) El trigger de alta, igual que en la migración 11 salvo el interval
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial timestamptz;
  v_nombre text;
  v_code text;
begin
  if now() < public.free_until() then
    v_trial := public.free_until();
  else
    -- Acá está el cambio: eran 30 días, después 7.
    v_trial := now() + interval '3 days';
  end if;

  -- Nombre del negocio: máximo 120 caracteres y sin caracteres de
  -- control (evita que alguien guarde un payload gigante o basura
  -- que después se imprime en el PDF y en el presupuesto público).
  v_nombre := left(
    regexp_replace(coalesce(new.raw_user_meta_data->>'business_name', ''), '[[:cntrl:]]', '', 'g'),
    120
  );

  -- Código de invitación: solo el formato que genera la app.
  -- Cualquier otra cosa se descarta antes de tocar la base.
  v_code := upper(btrim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
  if v_code !~ '^[A-Z0-9]{4,12}$' then
    v_code := null;
  end if;

  insert into public.profiles (id, email, business_name, plan, trial_ends_at, referral_code)
  values (new.id, new.email, v_nombre, 'free', v_trial, public.gen_referral_code())
  on conflict (id) do nothing;

  perform public.register_referral(new.id, v_code, new.email);

  -- Con "Confirm email" ACTIVADO (así tiene que estar), esto no se
  -- cumple todavía: la invitación queda pendiente hasta que el invitado
  -- confirme, y ahí la acredita el trigger on_auth_user_confirmed.
  if new.email_confirmed_at is not null then
    perform public.confirm_referral(new.id);
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2) Verificación
--    a) La función quedó con los 3 días:
--         select pg_get_functiondef('public.handle_new_user'::regproc)
--                like '%3 days%';
--       → tiene que dar true.
--
--    b) A nadie se le tocó la prueba en curso:
--         select count(*) from public.profiles
--          where trial_ends_at > now();
--       → el mismo número que antes de correr esto.
-- ============================================================
-- Fin de la migración 35
-- ============================================================
