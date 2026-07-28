-- ============================================================
-- CATI · Migración 08 · La prueba gratis pasa de 72 h a 1 MES
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos existentes.
--
-- Después del mes gratis el usuario debe suscribirse por USD 2/mes
-- (el bloqueo ya lo aplican las políticas de la migración 07).
-- ============================================================

-- 1) Usuarios NUEVOS: el trigger crea el perfil con 30 días de prueba.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, business_name, plan, trial_ends_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'business_name', ''),
    'free',
    now() + interval '30 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Usuarios YA registrados que siguen en plan free:
--    se les extiende la prueba a 30 días contados desde su alta.
--    Si ese cálculo diera menos de lo que ya tenían, se respeta el mayor.
--    Nunca se acorta la prueba de nadie.
update public.profiles
   set trial_ends_at = greatest(
         coalesce(trial_ends_at, now()),
         created_at + interval '30 days'
       )
 where plan <> 'premium';

-- 3) Perfiles faltantes (por si algún usuario quedó sin perfil).
insert into public.profiles (id, email, business_name, plan, trial_ends_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'business_name', ''),
  'free',
  now() + interval '30 days'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ============================================================
-- Recordatorio · ACTIVAR la suscripción de un usuario que pagó:
--   update public.profiles
--     set plan = 'premium',
--         premium_since = now(),
--         premium_until = now() + interval '1 month'
--     where email = 'cliente@ejemplo.com';
--
-- RENOVAR un mes más:
--   update public.profiles
--     set premium_until = greatest(premium_until, now()) + interval '1 month'
--     where email = 'cliente@ejemplo.com';
-- ============================================================
-- Fin de la migración 08
-- ============================================================
