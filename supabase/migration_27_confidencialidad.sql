-- ============================================================
-- CATI / NUMERA · Migración 27 · ACUERDOS DE CONFIDENCIALIDAD (NDA)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos, y correrla dos veces no hace daño.
--
-- ⚠ REQUIERE la migración 12 corrida antes (usa public.admins).
--
-- PARA QUÉ
--   El cliente que llega por Instagram pidiendo una app a medida no
--   quiere contar su idea hasta tener un papel firmado. Esto le manda un
--   link, firma con el dedo desde el celular, y el acuerdo queda firmado
--   por las dos partes en el mismo minuto.
--
-- ⚠ POR QUÉ ESTO ES SOLO PARA EL DUEÑO
--   Se pidió expresamente que la función exista solo en la cuenta del
--   dueño. El candado NO está en el menú de React (eso se puede saltear
--   desde la consola del navegador): está en las políticas RLS de abajo,
--   que exigen public.is_admin() para leer y para escribir, y en los RPC
--   públicos, que se niegan a servir el link si el dueño del acuerdo no
--   figura en public.admins.
--
-- ⚠ POR QUÉ EL TEXTO DEL ACUERDO SE GUARDA ENTERO EN LA FILA
--   La columna `cuerpo` guarda el texto completo tal como estaba el día
--   que se firmó, y `huella` su SHA-256. Si mañana se cambia la
--   plantilla en el código, lo ya firmado no se mueve: lo que se firmó
--   es lo que quedó escrito. Sin esto, un acuerdo firmado no probaría
--   nada.
-- ============================================================


-- ------------------------------------------------------------
-- 0) Freno: sin la migración 12 no existe public.admins y nada de
--    esto tendría candado.
-- ------------------------------------------------------------
do $freno$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'admins') then
    raise exception 'Falta la migración 12 (public.admins). Corré esa primero.';
  end if;
end
$freno$;


-- ------------------------------------------------------------
-- 1) ¿Este usuario (por id, no el que llama) es admin?
--    is_admin() de la migración 12 mira auth.uid(), que en un link
--    público es NULL. Los RPC de abajo necesitan preguntar por el
--    DUEÑO del acuerdo, así que hace falta esta variante.
-- ------------------------------------------------------------
create or replace function public.es_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.admins a where a.user_id = p_user);
$fn$;

revoke execute on function public.es_admin(uuid) from public, anon;
grant execute on function public.es_admin(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- 2) La tabla
-- ------------------------------------------------------------
create table if not exists public.ndas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  numero integer not null default 1,
  public_token uuid not null default gen_random_uuid(),

  -- La otra parte. Quedan vacíos a propósito: los completa el propio
  -- cliente cuando firma, desde el link. El que desconfía no quiere dar
  -- ni el nombre antes de leer lo que va a firmar, y además así los
  -- datos los pone quien firma y no un tercero por él.
  parte_nombre text not null default '',
  parte_doc text default '',
  parte_email text default '',
  parte_telefono text default '',
  parte_domicilio text default '',

  -- De qué se va a hablar, en una línea y SIN detalles: esta frase viaja
  -- en el link y la puede leer cualquiera que lo reciba.
  proyecto text default '',

  -- 0 = sin fecha de vencimiento, que es lo que usa la app. El check se
  -- ajusta más abajo para las bases donde esta tabla ya existía.
  vigencia_anios integer not null default 0 check (vigencia_anios between 0 and 20),
  jurisdiccion text not null default '',

  -- El acuerdo congelado + su huella. Ver el encabezado.
  cuerpo text not null default '',
  huella text default '',

  -- Firma del dueño
  firma_emisor text,
  firma_emisor_nombre text default '',
  firma_emisor_doc text default '',
  firmado_emisor_at timestamptz,

  -- Firma de la otra parte
  firma_parte text,
  firma_parte_nombre text default '',
  firma_parte_doc text default '',
  firmado_parte_at timestamptz,
  firma_parte_ip text,
  firma_parte_agente text,

  viewed_at timestamptz,
  status text not null default 'pendiente'
    check (status in ('pendiente','firmado','anulado')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `create table if not exists` no toca una tabla que ya existe, así que
-- el plazo indefinido hay que habilitarlo aparte para quien ya corrió una
-- versión anterior de esta migración. Correrlo dos veces no hace daño.
alter table public.ndas drop constraint if exists ndas_vigencia_anios_check;
alter table public.ndas
  add constraint ndas_vigencia_anios_check check (vigencia_anios between 0 and 20);
alter table public.ndas alter column vigencia_anios set default 0;

create unique index if not exists ndas_public_token_idx on public.ndas(public_token);
create index if not exists ndas_user_id_idx on public.ndas(user_id);

alter table public.ndas enable row level security;


-- ------------------------------------------------------------
-- 3) Candado: solo el dueño de la fila, y solo si es admin.
--    Un usuario común no ve nada y tampoco puede crear filas: sin la
--    segunda condición, cualquiera podría usar la tabla desde la
--    consola aunque no le aparezca el menú.
-- ------------------------------------------------------------
drop policy if exists "ndas: select propio admin" on public.ndas;
create policy "ndas: select propio admin" on public.ndas
  for select using (auth.uid() = user_id and public.is_admin());

drop policy if exists "ndas: insert propio admin" on public.ndas;
create policy "ndas: insert propio admin" on public.ndas
  for insert with check (auth.uid() = user_id and public.is_admin());

drop policy if exists "ndas: update propio admin" on public.ndas;
create policy "ndas: update propio admin" on public.ndas
  for update using (auth.uid() = user_id and public.is_admin())
  with check (auth.uid() = user_id and public.is_admin());

drop policy if exists "ndas: delete propio admin" on public.ndas;
create policy "ndas: delete propio admin" on public.ndas
  for delete using (auth.uid() = user_id and public.is_admin());


-- ------------------------------------------------------------
-- 4) Una firma no se pisa
--    Si alguien reenvía un UPDATE con la firma cambiada (o borrada)
--    desde la consola, Postgres lo rechaza. Vale para las dos partes:
--    ni siquiera el dueño puede reescribir una firma ya prestada.
-- ------------------------------------------------------------
create or replace function public.ndas_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.firmado_parte_at is not null and (
       new.firma_parte is distinct from old.firma_parte
    or new.firma_parte_nombre is distinct from old.firma_parte_nombre
    or new.firma_parte_doc is distinct from old.firma_parte_doc
    or new.firmado_parte_at is distinct from old.firmado_parte_at
  ) then
    raise exception 'la firma de la otra parte ya fue prestada y no se puede modificar';
  end if;

  if old.firmado_emisor_at is not null and (
       new.firma_emisor is distinct from old.firma_emisor
    or new.firmado_emisor_at is distinct from old.firmado_emisor_at
  ) then
    raise exception 'tu firma ya fue prestada y no se puede modificar';
  end if;

  -- El texto queda intocable cuando firma la OTRA PARTE, que es la que
  -- lo lee entero antes de firmar y la que completa sus propios datos en
  -- el hueco. Hasta ese momento el cuerpo todavía se completa: por eso no
  -- alcanza con mirar si ya firmó el dueño.
  if old.firmado_parte_at is not null
     and (new.cuerpo is distinct from old.cuerpo or new.huella is distinct from old.huella) then
    raise exception 'el acuerdo ya fue firmado: su texto no se puede cambiar';
  end if;

  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists ndas_guard_trg on public.ndas;
create trigger ndas_guard_trg
  before update on public.ndas
  for each row execute function public.ndas_guard();


-- ------------------------------------------------------------
-- 5) El link público: leer el acuerdo
--    No exige premium (a diferencia del presupuesto): exige que el
--    dueño sea admin. Nunca devuelve user_id ni el token.
-- ------------------------------------------------------------
create or replace function public.get_public_nda(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  n public.ndas;
begin
  select * into n from public.ndas where public_token = p_token;
  if not found then
    return null;
  end if;

  if not public.es_admin(n.user_id) then
    return null;
  end if;

  if n.status = 'anulado' then
    return null;
  end if;

  if n.viewed_at is null then
    update public.ndas set viewed_at = now() where id = n.id;
    select * into n from public.ndas where id = n.id;
  end if;

  return jsonb_build_object(
    'nda', to_jsonb(n)
             - 'user_id' - 'public_token' - 'client_id'
             - 'firma_parte_ip' - 'firma_parte_agente',
    -- Los datos del emisor van completos, con los canales de contacto.
    -- Es a propósito: del otro lado del link hay alguien que todavía no
    -- confía. Un nombre, un CUIT, un domicilio y un WhatsApp que
    -- responde son lo que separa «esto es serio» de «esto es un
    -- formulario raro que me mandaron». Campo por campo y no `to_jsonb`:
    -- así ninguna columna nueva del perfil se cuela sin decidirlo, y la
    -- firma guardada (firma_png) nunca sale por acá.
    'business', (
      select jsonb_build_object(
        'business_name', p.business_name,
        'logo_url', p.logo_url,
        'email', p.email,
        'phone', p.phone,
        'tax_id', p.tax_id,
        'address', p.address,
        'brand_color', p.brand_color,
        'hide_branding', p.hide_branding,
        'website', p.website,
        'whatsapp', p.whatsapp,
        'instagram', p.instagram,
        'facebook', p.facebook,
        'tiktok', p.tiktok,
        'youtube', p.youtube,
        'x', p.x
      )
      from public.profiles p where p.id = n.user_id
    )
  );
end;
$fn$;


-- ------------------------------------------------------------
-- 6) El link público: firmar
--    Congelado igual que la respuesta a un presupuesto: quien ya firmó
--    no puede volver a firmar ni cambiar lo firmado.
--
--    ⚠ ACÁ SE COMPLETA EL HUECO DE LA OTRA PARTE
--    El acuerdo se manda sin los datos del cliente: los escribe él mismo
--    al firmar. Este es el único lugar donde se rellenan, y el texto
--    identificatorio lo arma la base. Si lo armara el navegador y lo
--    mandara hecho, se podría firmar un acuerdo con el cuerpo cambiado.
--
--    ⚠ La regla de armado está escrita dos veces: acá y en
--      identificarParte() de src/lib/nda.js. Tienen que dar el MISMO
--      texto: el cliente ve el de allá mientras escribe y firma el de
--      acá. Si se toca una, se toca la otra.
-- ------------------------------------------------------------
drop function if exists public.sign_nda(uuid, text, text, text);

create or replace function public.sign_nda(
  p_token uuid,
  p_nombre text,
  p_doc text,
  p_firma text,
  p_domicilio text default '',
  p_email text default '',
  p_telefono text default ''
)
returns jsonb
language plpgsql
security definer
-- `extensions` va en el camino porque en Supabase pgcrypto (digest())
-- vive en ese schema y no en public.
set search_path = public, extensions
as $fn$
declare
  n public.ndas;
  v_ip text;
  v_agente text;
  v_ident text;
  v_cuerpo text;
  v_huella text;
begin
  select * into n from public.ndas where public_token = p_token;
  if not found or not public.es_admin(n.user_id) or n.status = 'anulado' then
    return null;
  end if;

  if n.firmado_parte_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'ya_firmado');
  end if;

  if coalesce(btrim(p_nombre), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'falta_nombre');
  end if;

  -- La firma es un PNG chico. El límite existe para que nadie use esta
  -- columna como depósito de archivos: ~300 KB de base64 son de sobra
  -- para un trazo hecho con el dedo.
  if p_firma is null or left(p_firma, 22) <> 'data:image/png;base64,' then
    return jsonb_build_object('ok', false, 'reason', 'falta_firma');
  end if;
  if length(p_firma) > 300000 then
    return jsonb_build_object('ok', false, 'reason', 'firma_muy_grande');
  end if;
  if substring(p_firma from 23) !~ '^[A-Za-z0-9+/=]+$' then
    return jsonb_build_object('ok', false, 'reason', 'falta_firma');
  end if;

  -- Con qué dispositivo y desde dónde se firmó. Es lo que convierte la
  -- firma en algo demostrable el día que haga falta.
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
    v_agente := left(coalesce(current_setting('request.headers', true)::json->>'user-agent', ''), 300);
  exception when others then
    v_ip := null;
    v_agente := null;
  end;

  -- El hueco del acuerdo, con los datos que acaba de escribir quien firma.
  v_ident := btrim(p_nombre);
  if coalesce(btrim(p_doc), '') <> '' then
    v_ident := v_ident || ', CUIT/DNI ' || btrim(p_doc);
  end if;
  if coalesce(btrim(p_domicilio), '') <> '' then
    v_ident := v_ident || ', con domicilio en ' || btrim(p_domicilio);
  end if;

  v_cuerpo := replace(n.cuerpo, '[[PARTE_B]]', v_ident);

  -- La huella se recalcula sobre el texto ya completo: es el que se
  -- firma. Se hace en la base (pgcrypto) y no en el navegador, para que
  -- sea la base la que responda por lo que quedó escrito. Va en grupos
  -- de a ocho para poder compararla a ojo contra el PDF.
  begin
    v_huella := btrim(regexp_replace(
      encode(digest(v_cuerpo, 'sha256'), 'hex'), '(.{8})', '\1 ', 'g'
    ));
  exception when others then
    -- Si pgcrypto no está a mano, se firma igual y queda la huella que
    -- calculó el navegador al crear el acuerdo. La firma no se cae por
    -- un dato de control.
    v_huella := n.huella;
  end;

  update public.ndas
     set cuerpo = v_cuerpo,
         huella = v_huella,
         parte_nombre = btrim(p_nombre),
         parte_doc = coalesce(btrim(p_doc), ''),
         parte_domicilio = coalesce(btrim(p_domicilio), ''),
         parte_email = coalesce(btrim(p_email), ''),
         parte_telefono = coalesce(btrim(p_telefono), ''),
         firma_parte = p_firma,
         firma_parte_nombre = btrim(p_nombre),
         firma_parte_doc = coalesce(btrim(p_doc), ''),
         firmado_parte_at = now(),
         firma_parte_ip = nullif(btrim(coalesce(v_ip, '')), ''),
         firma_parte_agente = nullif(btrim(coalesce(v_agente, '')), ''),
         status = case when firmado_emisor_at is not null then 'firmado' else status end
   where id = n.id
   returning * into n;

  -- El aviso en la campanita del dueño. Llega solo, sin recargar: la
  -- campanita ya escucha los avisos nuevos en vivo (migración 14).
  begin
    perform public.notify_user(
      n.user_id,
      'confidencialidad',
      n.firma_parte_nombre || ' firmó el acuerdo',
      'Ya está firmado por las dos partes. Podés bajar el PDF desde Confidencialidad.',
      '🤝'
    );
  exception when others then
    -- Sin la migración 14 no hay campanita. El acuerdo se firma igual:
    -- el aviso es un extra, no parte de la firma.
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'status', n.status,
    'cuerpo', n.cuerpo,
    'huella', n.huella,
    'firmado_parte_at', n.firmado_parte_at,
    'firma_parte_nombre', n.firma_parte_nombre,
    'firma_parte_doc', n.firma_parte_doc,
    'firma_parte', n.firma_parte
  );
end;
$fn$;

revoke execute on function public.get_public_nda(uuid) from public;
grant execute on function public.get_public_nda(uuid) to anon, authenticated;
revoke execute on function public.sign_nda(uuid, text, text, text, text, text, text) from public;
grant execute on function public.sign_nda(uuid, text, text, text, text, text, text) to anon, authenticated;


-- ------------------------------------------------------------
-- 7) Invalidar un link ya compartido (genera un token nuevo)
-- ------------------------------------------------------------
create or replace function public.rotate_nda_token(p_nda uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t uuid;
begin
  if not public.is_admin() then
    raise exception 'no autorizado';
  end if;

  update public.ndas
     set public_token = gen_random_uuid()
   where id = p_nda and user_id = auth.uid()
   returning public_token into t;

  return t;
end;
$fn$;

revoke execute on function public.rotate_nda_token(uuid) from public, anon;
grant execute on function public.rotate_nda_token(uuid) to authenticated;


-- ------------------------------------------------------------
-- 8) Tu firma, guardada una sola vez
--    Se sube una foto de la firma hecha en papel, la app la limpia y la
--    deja acá. Desde entonces cada acuerdo nace ya firmado: se arma, se
--    manda y listo.
--
--    ⚠ ES UN DATO SENSIBLE
--    Una firma manuscrita se puede copiar. Por eso no va en el código ni
--    en un archivo del repositorio: va en la fila del perfil, que solo
--    lee su dueño (RLS de profiles, schema.sql). Los RPC públicos
--    (get_public_budget, get_public_nda) arman el objeto `business`
--    campo por campo y no la incluyen, así que no se filtra por un link
--    compartido. En el acuerdo se copia recién cuando se firma, y esa
--    copia sí la ve quien tenga el link: es justamente lo que le
--    demuestra al cliente que la otra parte ya firmó.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists firma_png text;

grant update (firma_png) on public.profiles to authenticated;
