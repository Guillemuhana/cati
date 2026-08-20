-- ============================================================
-- CATI / NUMERA · Migración 26 · ENTRAR CON GOOGLE (y el alta arreglada)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos, y correrla dos veces no hace daño.
--
-- ⚠ ESTA MIGRACIÓN ARREGLA UN BUG QUE YA ESTÁ EN PRODUCCIÓN
--
--   La migración 19 (rubro) rehízo handle_new_user() partiendo de la
--   versión de la 07, sin darse cuenta de que las migraciones 10 y 11 ya
--   la habían ampliado. Al correrla, se perdieron tres cosas para TODA
--   cuenta creada después:
--
--     1. El código de invitación propio. Queda en NULL, así que la
--        pantalla «Invitar y ganar» dice «Todavía no tenés código» y no
--        hay link para compartir.
--     2. El registro de la invitación. Quien entra por un link ?ref= no
--        queda anotado, así que nadie puede juntar los 3 invitados ni
--        cobrar los 3 meses. El premio era, en los hechos, inalcanzable.
--     3. La prueba gratis. Volvió a 72 horas en vez de los 30 días (o
--        hasta el fin de la promo, lo que sea más lejos).
--
--   Acá se rehace la función bien: la versión completa de la 11 MÁS el
--   rubro de la 19. Y se repara lo de los usuarios afectados.
--
-- QUÉ AGREGA, ADEMÁS
--   claim_referral(): entrar con Google no puede llevar metadatos (el
--   alta la hace Google, no nuestro formulario), así que el código de
--   invitación no viaja como en el alta por email. Esta función deja que
--   la app lo acredite justo después, con candados para que no se pueda
--   abusar.
--
-- ⚠ FALTA UN PASO FUERA DE ACÁ (sin esto, el botón de Google no anda):
--   Supabase → Authentication → Providers → Google → habilitarlo y pegar
--   el Client ID y el Client Secret que se sacan en Google Cloud Console
--   (APIs & Services → Credentials → OAuth client ID → Web application).
--   En Google Cloud, en «Authorized redirect URIs», va:
--       https://<tu-proyecto>.supabase.co/auth/v1/callback
--   Y en Supabase → Authentication → URL Configuration, la Site URL y las
--   Redirect URLs tienen que incluir el dominio de la app.
-- ============================================================


-- ------------------------------------------------------------
-- 0) Freno: sin la 19 no existe la columna rubro, y sin la 10 no
--    existen ni el código de invitación ni las funciones que se usan
--    más abajo.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'rubro'
  ) then
    raise exception 'Falta la migración 19. Corré primero supabase/migration_19_rubro.sql.';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'referral_code'
  ) then
    raise exception 'Falta la migración 10. Corré primero supabase/migration_10_invitaciones.sql.';
  end if;
end
$$;


-- ------------------------------------------------------------
-- 1) El alta, completa: la versión de la 11 más el rubro de la 19
--    Sirve igual para un alta por email que por Google. La diferencia
--    es que la de Google no trae metadatos: el nombre del negocio queda
--    vacío (lo pide la pantalla de bienvenida) y el rubro también.
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
  -- control (evita que alguien guarde un payload gigante o basura que
  -- después se imprime en el PDF y en el presupuesto público).
  v_nombre := left(
    regexp_replace(coalesce(new.raw_user_meta_data->>'business_name', ''), '[[:cntrl:]]', '', 'g'),
    120
  );

  -- Código de invitación: solo el formato que genera la app.
  v_code := upper(btrim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
  if v_code !~ '^[A-Z0-9]{4,12}$' then
    v_code := null;
  end if;

  insert into public.profiles (id, email, business_name, rubro, plan, trial_ends_at, referral_code)
  values (
    new.id,
    new.email,
    v_nombre,
    coalesce(new.raw_user_meta_data->>'rubro', ''),
    'free',
    v_trial,
    public.gen_referral_code()
  )
  on conflict (id) do nothing;

  perform public.register_referral(new.id, v_code, new.email);

  -- Con "Confirm email" activado esto no se cumple todavía en un alta por
  -- email: la invitación queda pendiente hasta que confirme. Con Google sí
  -- se cumple, porque el mail ya viene verificado por ellos.
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
-- 2) Reparar a los que se dieron de alta con la función rota
-- ------------------------------------------------------------

-- 2.a) El código propio que nunca se generó.
--      Uno por uno a propósito: dentro de un solo UPDATE masivo,
--      gen_referral_code() no vería los códigos recién puestos y podría
--      repetir uno (mismo criterio que la migración 10).
do $$
declare r record;
begin
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles
       set referral_code = public.gen_referral_code()
     where id = r.id;
  end loop;
end
$$;

-- 2.b) La prueba de 72 horas. `greatest` garantiza que a nadie se le
--      acorte lo que ya tenía, y hace la sentencia idempotente.
update public.profiles
   set trial_ends_at = greatest(coalesce(trial_ends_at, now()), public.free_until())
 where plan <> 'premium'
   and now() < public.free_until();

-- 2.c) Las invitaciones que no se anotaron.
--      Se recuperan desde los metadatos del alta, que sí quedaron
--      guardados en auth.users aunque el trigger no los usara.
do $$
declare u record;
begin
  for u in
    select au.id, au.email, au.email_confirmed_at,
           upper(btrim(coalesce(au.raw_user_meta_data->>'referral_code', ''))) as code
      from auth.users au
      join public.profiles p on p.id = au.id
     where p.referred_by is null
       and coalesce(au.raw_user_meta_data->>'referral_code', '') <> ''
  loop
    if u.code ~ '^[A-Z0-9]{4,12}$' then
      perform public.register_referral(u.id, u.code, u.email);
      if u.email_confirmed_at is not null then
        perform public.confirm_referral(u.id);
      end if;
    end if;
  end loop;
end
$$;


-- ------------------------------------------------------------
-- 3) Acreditar la invitación después de entrar con Google
--    El alta por Google no pasa por nuestro formulario, así que el
--    código no puede viajar en los metadatos. La app lo tiene guardado
--    en el navegador y lo manda apenas vuelve de Google.
--
--    Tres candados, porque esto sí lo llama el cliente:
--      · solo para uno mismo (auth.uid(), no un id que le pasen);
--      · solo si todavía no tiene quién lo invitó;
--      · solo dentro de la primera hora de vida de la cuenta, para que
--        una cuenta vieja no pueda regalarle un invitado a nadie.
--    El resto de las validaciones (código inexistente, autoinvitación,
--    tope de 3) ya las hace register_referral.
-- ------------------------------------------------------------
create or replace function public.claim_referral(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := auth.uid();
  v_email text;
  v_creado timestamptz;
  v_conf  timestamptz;
  v_code  text;
begin
  if v_id is null then
    return;
  end if;

  v_code := upper(btrim(coalesce(p_code, '')));
  if v_code !~ '^[A-Z0-9]{4,12}$' then
    return;
  end if;

  if exists (select 1 from public.profiles where id = v_id and referred_by is not null) then
    return;
  end if;

  select email, created_at, email_confirmed_at
    into v_email, v_creado, v_conf
    from auth.users
   where id = v_id;

  if v_creado is null or v_creado < now() - interval '1 hour' then
    return;
  end if;

  perform public.register_referral(v_id, v_code, v_email);

  if v_conf is not null then
    perform public.confirm_referral(v_id);
  end if;
end;
$$;

revoke execute on function public.claim_referral(text) from public, anon;
grant  execute on function public.claim_referral(text) to authenticated;


-- ------------------------------------------------------------
-- 4) Verificación
-- ------------------------------------------------------------
-- a) Ya no hay perfiles sin código de invitación:
--      select count(*) from public.profiles where referral_code is null;
--    → 0
--
-- b) Nadie quedó con la prueba de 72 horas:
--      select count(*) from public.profiles
--       where plan <> 'premium' and trial_ends_at < now() + interval '7 days';
--    → 0 (mientras siga vigente la promo gratis)
--
-- c) El alta vuelve a estar completa. Creá una cuenta de prueba por email
--    y revisá que el perfil salga con referral_code, con el rubro elegido
--    y con trial_ends_at en la fecha de fin de promo:
--      select business_name, rubro, referral_code, trial_ends_at
--        from public.profiles order by created_at desc limit 1;
--
-- d) Google: entrá con Google desde el login. Tiene que crearse el perfil
--    con business_name vacío (la app te pide el nombre en la bienvenida) y
--    con su código de invitación puesto.
--
-- e) El candado de claim_referral: logueado con una cuenta vieja, en la
--    consola del navegador,
--      await supabase.rpc('claim_referral', { p_code: 'ABCD12' })
--    no tiene que anotar nada (la cuenta tiene más de una hora).

-- ============================================================
-- Fin de la migración 26
-- ============================================================
