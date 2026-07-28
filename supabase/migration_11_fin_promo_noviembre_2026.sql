-- ============================================================
-- CATI / NUMERA · Migración 11 · FIN DE LA PROMO GRATIS
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos.
--
-- QUÉ HACE
--   1. La etapa "todo gratis" termina sola el 1 de NOVIEMBRE de 2026.
--      A partir de esa fecha vuelve a regir el candado premium sin que
--      tengas que ejecutar nada ni desplegar nada.
--   2. Endurece lo que quedó abierto en la migración 10.
--
-- ⚠ POR QUÉ ES POR FECHA Y NO POR UN INTERRUPTOR MANUAL
--   La migración 09 dejó is_premium() devolviendo `select true`. Eso
--   significa que HOY el candado del servidor está desactivado: si el
--   1 de noviembre solo cambiaras FREE_FOR_ALL en el JavaScript, la app
--   se vería "cerrada" pero la API REST seguiría regalando todo a
--   cualquiera que abra la pestaña Network del navegador. Con la fecha
--   adentro de is_premium(), el servidor se cierra solo.
-- ============================================================


-- ------------------------------------------------------------
-- 1) La fecha, en un solo lugar
--    Si algún día la corrés, cambiás SOLO esta función (y la
--    constante FREE_UNTIL de src/lib/config.js, que es el mismo
--    instante escrito para el navegador).
--    Zona horaria: Argentina (UTC-3).
-- ------------------------------------------------------------
create or replace function public.free_until()
returns timestamptz
language sql
immutable
as $$
  select timestamptz '2026-11-01 00:00:00-03';
$$;

grant execute on function public.free_until() to authenticated, anon, service_role;


-- ------------------------------------------------------------
-- 2) El candado premium vuelve a la vida el 1/11/2026
--    Reemplaza el `select true` de la migración 09.
-- ------------------------------------------------------------
create or replace function public.is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Etapa promocional: todo abierto para todos.
    when now() < public.free_until() then true
    -- A partir del 1/11/2026: suscripción paga vigente o prueba vigente.
    else coalesce(
      (
        select
          (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))
          or (p.trial_ends_at is not null and p.trial_ends_at > now())
        from public.profiles p
        where p.id = p_user
      ),
      false
    )
  end;
$$;

revoke execute on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- 3) Alta de usuarios, con la promo y con la vida después de la promo
--
--    · Antes del 1/11/2026: la prueba de todos termina ese día (es la
--      promo de lanzamiento; terminan todos juntos).
--    · Desde el 1/11/2026: prueba estándar de 30 días desde el alta.
--
--    Además:
--    · Se recortan los datos que manda el navegador (business_name) y
--      se valida el formato del código de invitación antes de usarlo.
--      raw_user_meta_data es 100% controlado por quien se registra: es
--      la única entrada de este trigger que un atacante elige.
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
    v_trial := now() + interval '30 days';
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 4) Los que YA están registrados: prueba hasta el 1/11/2026
--    greatest() garantiza que a nadie se le acorte lo que ya tenía,
--    y hace la sentencia idempotente (correrla dos veces no regala
--    tiempo de más, ni tampoco después de noviembre).
-- ------------------------------------------------------------
update public.profiles
   set trial_ends_at = greatest(coalesce(trial_ends_at, now()), public.free_until())
 where plan <> 'premium'
   and now() < public.free_until();


-- ============================================================
-- SEGURIDAD · Cabos sueltos de la migración 10
-- ============================================================

-- 5.a) gen_referral_code() era ejecutable por cualquier usuario logueado
--      vía RPC. No filtra datos, pero hace un LOOP con consulta a
--      profiles en cada vuelta: llamada en bucle es un desperdicio de
--      CPU regalado. Solo la usan los triggers.
revoke execute on function public.gen_referral_code() from public, anon, authenticated;

-- 5.b) mask_email() tampoco tiene por qué ser un servicio público.
revoke execute on function public.mask_email(text) from public, anon;

-- 5.c) Si se borra una cuenta invitada, el contador del que invitó
--      quedaba inflado (la fila de referrals se va por cascade, pero
--      referrals_count no se recalculaba). Ahora se recalcula solo.
--      El premio ya otorgado NO se quita: se ganó en su momento.
create or replace function public.referrals_recount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set referrals_count = least(
           (select count(*) from public.referrals
             where referrer_id = old.referrer_id and status = 'confirmado'),
           3
         )
   where id = old.referrer_id;
  return old;
end;
$$;

drop trigger if exists referrals_recount_delete on public.referrals;
create trigger referrals_recount_delete
  after delete on public.referrals
  for each row execute function public.referrals_recount();

-- 5.d) Verificación de que el candado quedó bien puesto.
--      Antes del 1/11/2026 tiene que dar TRUE; después, FALSE para una
--      cuenta sin suscripción ni prueba vigente.
--   select public.is_premium('00000000-0000-0000-0000-000000000000'::uuid);
--
--      Y para probar el "día después" sin esperar a noviembre, en una
--      transacción que después cancelás:
--   begin;
--     create or replace function public.free_until() returns timestamptz
--       language sql immutable as $$ select timestamptz '2020-01-01' $$;
--     select public.is_premium('<uuid-de-una-cuenta-free>');  -- debe dar false
--   rollback;


-- ============================================================
-- RECORDATORIO PARA EL 1 DE NOVIEMBRE DE 2026
--   1. Poné PAYMENT_URL en src/lib/config.js (link de suscripción
--      de Stripe con precio recurrente).
--   2. El alta de premium la hace el webhook de Stripe llamando a
--      admin_set_premium(). NUNCA el navegador. Ver SEGURIDAD.md §3.
--   3. No hace falta tocar is_premium(): se cierra sola esa madrugada.
-- ============================================================
-- Fin de la migración 11
-- ============================================================
