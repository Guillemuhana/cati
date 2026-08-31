-- ============================================================
-- CATI / NUMERA · Migración 30 · FRENO A LA FUERZA BRUTA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   Hoy cualquiera puede probar contraseñas contra una cuenta todas las
--   veces que quiera. La app ya frena al que insiste desde la pantalla
--   (src/lib/limiteIntentos.js), pero eso es maquillaje: el que ataca en
--   serio no usa nuestra pantalla, le pega directo al endpoint de
--   Supabase con curl y ahí ese archivo no existe.
--
--   Esto corre DENTRO de la base, en el momento exacto en que Supabase
--   verifica una contraseña, y decide si la deja pasar. Da igual desde
--   dónde venga el intento: navegador, script, o la API a mano.
--
-- CÓMO FUNCIONA
--   Se cuentan los fallos por usuario. A los 5 la cuenta queda trabada un
--   minuto; el tramo crece hasta una hora. Un ingreso correcto borra la
--   cuenta entera: al que se equivocó cuatro veces y acertó la quinta no
--   le queda nada colgando.
--
--   La cuenta NO se traba para siempre y no hace falta que nadie la
--   destrabe a mano. Un bloqueo eterno es un ataque en sí mismo: alcanza
--   con que alguien tipee mal el mail de un competidor diez veces para
--   dejarlo afuera de su propia app.
--
-- ⚠ DESPUÉS DE CORRER ESTO HAY QUE ENCENDERLO A MANO
--   Dashboard → Authentication → Hooks → «Password verification attempt»
--   → Enable, y elegir la función `hooks.password_verification_attempt`.
--   Sin ese paso la función queda escrita pero no la llama nadie.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Un esquema aparte
--    No va en `public`: ahí adentro todo lo alcanza PostgREST, y esta
--    tabla dice qué cuentas están siendo atacadas. Es justo lo que le
--    sirve saber al que ataca.
-- ------------------------------------------------------------
create schema if not exists hooks;

revoke all on schema hooks from anon, authenticated, public;
grant usage on schema hooks to supabase_auth_admin;

-- ------------------------------------------------------------
-- 2) El registro de intentos
--    Una fila por usuario, y solo mientras está fallando: el que entra
--    bien no deja rastro acá.
-- ------------------------------------------------------------
create table if not exists hooks.intentos_ingreso (
  user_id uuid primary key,
  fallos integer not null default 0,
  ultimo_fallo timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

alter table hooks.intentos_ingreso enable row level security;

-- Sin políticas: con RLS encendida y ninguna política, nadie llega por
-- la API. La función de abajo es `security definer`, así que entra por
-- arriba de RLS — que es exactamente lo que queremos: solo ella.
revoke all on table hooks.intentos_ingreso from anon, authenticated, public;
grant select, insert, update, delete on table hooks.intentos_ingreso to supabase_auth_admin;

-- ------------------------------------------------------------
-- 3) El hook
--    Supabase lo llama con { user_id, valid } cada vez que verifica una
--    contraseña, y espera { decision: 'continue' | 'reject' }.
--
--    `search_path = ''` y todo con el nombre completo: una función
--    security definer con el search_path abierto es la forma clásica de
--    escalar privilegios en Postgres.
-- ------------------------------------------------------------
create or replace function hooks.password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  fue_valida boolean;
  fallos_previos integer;
  ultimo timestamptz;
  bloqueo timestamptz;
  minutos integer;
begin
  uid := nullif(event->>'user_id', '')::uuid;
  fue_valida := coalesce((event->>'valid')::boolean, false);

  -- Sin usuario no hay a quién contarle los intentos. Se deja pasar:
  -- este hook endurece el ingreso, no puede ser el que lo rompa.
  if uid is null then
    return jsonb_build_object('decision', 'continue');
  end if;

  select fallos, ultimo_fallo, bloqueado_hasta
    into fallos_previos, ultimo, bloqueo
    from hooks.intentos_ingreso
   where user_id = uid;

  -- Está en penitencia: se corta acá, aunque la contraseña fuera la
  -- correcta. Es el punto del asunto — el que la adivina en el intento
  -- 5.000 tampoco entra.
  if bloqueo is not null and bloqueo > now() then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Too many failed sign-in attempts. Please try again later.'
    );
  end if;

  -- Entró bien: se le borra el prontuario.
  if fue_valida then
    delete from hooks.intentos_ingreso where user_id = uid;
    return jsonb_build_object('decision', 'continue');
  end if;

  -- Falló. Si el último error fue hace rato, no viene de una ráfaga:
  -- es alguien que se equivoca cada tanto y arranca de cero.
  if ultimo is null or ultimo < now() - interval '6 hours' then
    fallos_previos := 0;
  end if;

  fallos_previos := coalesce(fallos_previos, 0) + 1;

  minutos := case
    when fallos_previos >= 12 then 60
    when fallos_previos >= 10 then 15
    when fallos_previos >= 8 then 5
    when fallos_previos >= 5 then 1
    else 0
  end;

  insert into hooks.intentos_ingreso (user_id, fallos, ultimo_fallo, bloqueado_hasta)
  values (
    uid,
    fallos_previos,
    now(),
    case when minutos > 0 then now() + make_interval(mins => minutos) else null end
  )
  on conflict (user_id) do update
    set fallos = excluded.fallos,
        ultimo_fallo = excluded.ultimo_fallo,
        bloqueado_hasta = excluded.bloqueado_hasta;

  -- Se deja seguir: que el mensaje siga siendo «contraseña incorrecta»
  -- y no «te quedan 2 intentos». Avisarle al que ataca cuántos le
  -- quedan es regalarle el mapa.
  return jsonb_build_object('decision', 'continue');
end;
$$;

-- ------------------------------------------------------------
-- 4) Quién puede ejecutarla
--    Solo el usuario interno de Auth. Si la pudiera llamar `anon`,
--    cualquiera podría inventar intentos fallidos con el user_id de otro
--    y dejarlo afuera de su propia cuenta.
-- ------------------------------------------------------------
revoke execute on function hooks.password_verification_attempt(jsonb) from anon, authenticated, public;
grant execute on function hooks.password_verification_attempt(jsonb) to supabase_auth_admin;

-- ------------------------------------------------------------
-- 5) Verificación
--    a) La función existe:
--         select proname from pg_proc p
--           join pg_namespace n on n.oid = p.pronamespace
--          where n.nspname = 'hooks';
--
--    b) Probar el conteo sin tocar ninguna cuenta real (poné un uuid
--       inventado y corrélo cinco veces; a la quinta tiene que empezar a
--       devolver 'reject'):
--         select hooks.password_verification_attempt(
--           jsonb_build_object('user_id', '00000000-0000-0000-0000-000000000001', 'valid', false)
--         );
--         select * from hooks.intentos_ingreso;
--
--    c) Limpiar la prueba:
--         delete from hooks.intentos_ingreso
--          where user_id = '00000000-0000-0000-0000-000000000001';
--
--    d) Y NO OLVIDAR el paso del dashboard: Authentication → Hooks →
--       «Password verification attempt» → Enable.
-- ------------------------------------------------------------

-- ============================================================
-- Fin de la migración 30
-- ============================================================
