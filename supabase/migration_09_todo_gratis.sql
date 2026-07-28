-- ============================================================
-- CATI · Migración 09 · TODO GRATIS (sin bloqueos por plan)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- La migración 07 dejó el candado premium en la BASE DE DATOS:
-- todas las políticas RLS de productos, plantillas, facturas, enlace
-- público, etc. preguntan por public.is_premium(auth.uid()).
--
-- Para abrir todo sin desarmar esas políticas, alcanza con que esa
-- función devuelva siempre true. Los datos del plan (plan,
-- trial_ends_at, premium_until) siguen guardándose intactos, así que
-- volver a cobrar es cambiar una sola función.
--
-- ⚠ En la app hay que dejar FREE_FOR_ALL = true en src/lib/config.js.
-- ============================================================

create or replace function public.is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- TODO GRATIS: mientras estemos en esta etapa, todos tienen acceso
  -- completo. Ver la sección "VOLVER A COBRAR" al final del archivo.
  select true;
$$;

revoke execute on function public.is_premium(uuid) from public;
grant execute on function public.is_premium(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- Promo de lanzamiento: la prueba pasa de 1 mes a 2 MESES.
-- (Reemplaza los 30 días de la migración 08.) Queda registrada en
-- trial_ends_at para el día que se apague el "todo gratis".
-- ------------------------------------------------------------
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
    now() + interval '60 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios ya registrados sin suscripción paga: 2 meses desde HOY para
-- los que ya tenían la prueba vencida, y nunca se acorta la de nadie.
update public.profiles
   set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now() + interval '60 days')
 where plan <> 'premium';


-- ============================================================
-- VOLVER A COBRAR
-- Cuando arranque la monetización: poner FREE_FOR_ALL = false en
-- src/lib/config.js y ejecutar este bloque (sin los guiones).
-- ============================================================
-- create or replace function public.is_premium(p_user uuid)
-- returns boolean
-- language sql
-- stable
-- security definer
-- set search_path = public
-- as $$
--   select coalesce(
--     (
--       select
--         -- suscripción paga vigente
--         (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))
--         -- o prueba gratuita vigente
--         or (p.trial_ends_at is not null and p.trial_ends_at > now())
--       from public.profiles p
--       where p.id = p_user
--     ),
--     false
--   );
-- $$;
--
-- revoke execute on function public.is_premium(uuid) from public;
-- grant execute on function public.is_premium(uuid) to authenticated, service_role;
-- ============================================================
-- Fin de la migración 09
-- ============================================================
