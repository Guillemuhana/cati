-- ============================================================
-- CATI / NUMERA · Migración 10 · INVITÁ Y GANÁ 3 MESES PREMIUM
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos.
--
-- QUÉ HACE
--   · Cada usuario tiene un código propio y un link para recomendar
--     la app: https://tu-dominio/registro?ref=CODIGO
--   · Se pueden sumar hasta 3 invitados.
--   · Cuando los 3 se registran (y confirman su email, si tenés la
--     confirmación activada en Supabase), el que invitó recibe
--     3 MESES de premium, una sola vez.
--
-- POR QUÉ TODO ESTO VIVE EN LA BASE DE DATOS
--   El premio es plata. Si el conteo lo llevara React, cualquiera
--   podría regalarse 3 meses desde la consola del navegador. Acá el
--   único que puede tocar el contador y la fecha de premium es un
--   trigger security definer; el cliente ni siquiera tiene permiso
--   de UPDATE sobre esas columnas (migración 07, punto 1.a).
-- ============================================================


-- ------------------------------------------------------------
-- 1) Columnas nuevas en profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists referral_code    text,
  add column if not exists referred_by      uuid references auth.users(id) on delete set null,
  add column if not exists referrals_count  integer not null default 0,
  add column if not exists referral_bonus_at timestamptz;

comment on column public.profiles.referral_code     is 'Código propio para invitar (va en el link ?ref=).';
comment on column public.profiles.referred_by       is 'Quién invitó a este usuario.';
comment on column public.profiles.referrals_count   is 'Invitados confirmados. Tope 3.';
comment on column public.profiles.referral_bonus_at is 'Cuándo se otorgaron los 3 meses. Null = todavía no.';


-- ------------------------------------------------------------
-- 2) Generador de códigos
--    6 caracteres sin vocales ni caracteres confundibles (0/O, 1/I/L)
--    para que se puedan dictar por teléfono sin errores.
-- ------------------------------------------------------------
create or replace function public.gen_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alfabeto constant text := '23456789BCDFGHJKMNPQRSTVWXYZ';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

-- El índice va ANTES del backfill: así, si dos códigos al azar salieran
-- iguales, el insert falla en el acto en vez de romper la creación del
-- índice al final.
create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code);

-- Códigos para los usuarios que ya existen. Fila por fila a propósito:
-- dentro de un solo UPDATE masivo, gen_referral_code() no vería los
-- códigos que va generando esa misma sentencia y podría repetir.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles
       set referral_code = public.gen_referral_code()
     where id = r.id;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 3) Tabla de invitaciones
--    Una fila por invitado. `invited_masked` es el email tapado
--    (ju•••@gmail.com) que es lo único que ve quien invitó: el email
--    completo del invitado es dato del invitado, no del que invita.
-- ------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  invited_id uuid not null unique references auth.users(id) on delete cascade,
  invited_email text,
  invited_masked text,
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmado')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- Quien invitó ve sus invitaciones. Nadie más.
drop policy if exists "referrals: select own" on public.referrals;
create policy "referrals: select own" on public.referrals
  for select using (auth.uid() = referrer_id);

-- El cliente NUNCA escribe acá: las filas las crea el trigger.
revoke all on public.referrals from anon, authenticated;
grant select (id, referrer_id, invited_masked, status, created_at, confirmed_at)
  on public.referrals to authenticated;


-- ------------------------------------------------------------
-- 4) Tapar el email: juan.perez@gmail.com → ju•••@gmail.com
-- ------------------------------------------------------------
create or replace function public.mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then '—'
    else substr(split_part(p_email, '@', 1), 1, 2) || '•••@' || split_part(p_email, '@', 2)
  end;
$$;


-- ------------------------------------------------------------
-- 5) Confirmar una invitación y, si llegó a 3, dar el premio
--    Se llama sola desde los triggers. Es idempotente: llamarla dos
--    veces por el mismo invitado no suma dos veces ni regala 6 meses.
-- ------------------------------------------------------------
create or replace function public.confirm_referral(p_invited uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.referrals;
  n int;
begin
  -- Solo pasa de 'pendiente' a 'confirmado' una vez (el where status
  -- = 'pendiente' hace de candado contra el doble conteo).
  update public.referrals
     set status = 'confirmado',
         confirmed_at = now()
   where invited_id = p_invited
     and status = 'pendiente'
  returning * into r;

  if not found then
    return;
  end if;

  select count(*) into n
    from public.referrals
   where referrer_id = r.referrer_id
     and status = 'confirmado';

  update public.profiles
     set referrals_count = least(n, 3)
   where id = r.referrer_id;

  -- El premio: 3 meses, al completar los 3 invitados, una sola vez.
  -- greatest(...) hace que se sumen a lo que ya tenga en vez de
  -- pisarle una suscripción paga vigente.
  if n >= 3 then
    update public.profiles
       set plan          = 'premium',
           premium_since = coalesce(premium_since, now()),
           premium_until = greatest(coalesce(premium_until, now()), now()) + interval '3 months',
           referral_bonus_at = now()
     where id = r.referrer_id
       and referral_bonus_at is null;
  end if;
end;
$$;

revoke execute on function public.confirm_referral(uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 6) Registrar la invitación cuando se crea la cuenta
-- ------------------------------------------------------------
create or replace function public.register_referral(p_invited uuid, p_code text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_id uuid;
  confirmados int;
begin
  if p_code is null or btrim(p_code) = '' then
    return;
  end if;

  select id into ref_id
    from public.profiles
   where referral_code = upper(btrim(p_code));

  -- Código inexistente o autoinvitación: se ignora en silencio y el
  -- usuario se registra normalmente.
  if ref_id is null or ref_id = p_invited then
    return;
  end if;

  -- Tope de 3: una vez que tiene 3 confirmados, el link deja de sumar.
  -- (Se cuentan los confirmados, no los pendientes, para que 3 invitados
  --  que nunca confirmaron no le bloqueen el premio para siempre.)
  select count(*) into confirmados
    from public.referrals
   where referrer_id = ref_id and status = 'confirmado';

  if confirmados >= 3 then
    return;
  end if;

  insert into public.referrals (referrer_id, invited_id, invited_email, invited_masked)
  values (ref_id, p_invited, p_email, public.mask_email(p_email))
  on conflict (invited_id) do nothing;

  update public.profiles set referred_by = ref_id where id = p_invited;
end;
$$;

revoke execute on function public.register_referral(uuid, text, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 7) Trigger de alta: perfil + código propio + invitación
--    Reemplaza al de la migración 09 conservando los 60 días de promo.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, business_name, plan, trial_ends_at, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'business_name', ''),
    'free',
    now() + interval '60 days',
    public.gen_referral_code()
  )
  on conflict (id) do nothing;

  -- El código de quien lo invitó viaja en el metadata del signUp.
  perform public.register_referral(
    new.id,
    new.raw_user_meta_data->>'referral_code',
    new.email
  );

  -- Si NO tenés activada la confirmación de email en Supabase, el alta
  -- ya viene confirmada y la invitación cuenta al instante. Si la tenés
  -- activada, queda pendiente hasta que el invitado confirme (trigger 8).
  if new.email_confirmed_at is not null then
    perform public.confirm_referral(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 8) Trigger de confirmación de email
--    "Registrarse exitosamente" = email confirmado. Sin esto,
--    alguien podría inventar 3 direcciones falsas y cobrar el premio.
-- ------------------------------------------------------------
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.confirm_referral(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.handle_user_confirmed();


-- ------------------------------------------------------------
-- 9) Candado: el cliente no puede tocar nada de invitaciones
--    Amplía el guard de la migración 07 con las columnas nuevas.
-- ------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.id                := old.id;
    new.plan              := old.plan;
    new.trial_ends_at     := old.trial_ends_at;
    new.premium_since     := old.premium_since;
    new.premium_until     := old.premium_until;
    -- Invitaciones (migración 10): ni el código, ni el contador,
    -- ni el premio se editan desde el navegador.
    new.referral_code     := old.referral_code;
    new.referred_by       := old.referred_by;
    new.referrals_count   := old.referrals_count;
    new.referral_bonus_at := old.referral_bonus_at;

    if new.hide_branding and not public.is_premium(old.id) then
      new.hide_branding := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_guard();


-- ------------------------------------------------------------
-- 10) ADMIN · consultas útiles (SQL Editor)
-- ------------------------------------------------------------
-- Quién invitó a quién y cómo viene:
--   select p.email, p.referral_code, p.referrals_count, p.referral_bonus_at
--     from public.profiles p
--    where p.referrals_count > 0
--    order by p.referrals_count desc;
--
-- Invitaciones pendientes (se registraron pero no confirmaron el email):
--   select r.invited_email, r.created_at, pr.email as invito
--     from public.referrals r
--     join public.profiles pr on pr.id = r.referrer_id
--    where r.status = 'pendiente';
--
-- Confirmar a mano una invitación (soporte):
--   select public.confirm_referral('<uuid-del-invitado>');

-- ============================================================
-- Fin de la migración 10
-- ============================================================
