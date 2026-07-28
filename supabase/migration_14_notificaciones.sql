-- ============================================================
-- CATI / NUMERA · Migración 14 · AVISOS PARA EL USUARIO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere las migraciones 10 a 13 corridas antes.
--
-- QUÉ HACE
--   Cuando le regalás meses de premium a alguien desde el panel, esa
--   persona ve un aviso con una campanita la próxima vez que entra.
--   Lo mismo cuando cobra los 3 meses por completar sus invitaciones.
--
-- POR QUÉ ADENTRO DE LA APP Y NO POR EMAIL
--   Mandar mails desde Postgres necesita un servicio externo (Resend,
--   SendGrid) con su clave, su dominio verificado y su Edge Function.
--   Es un proyecto aparte. El aviso adentro de la app se ve seguro, no
--   cae en spam y no depende de que nadie contrate nada. Cuando quieras
--   sumar el mail, el enganche es esta misma tabla.
-- ============================================================


-- ------------------------------------------------------------
-- 1) La tabla
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,              -- 'regalo' | 'referido' | 'sistema'
  icono text default '🎁',
  titulo text not null,
  cuerpo text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Cada uno ve solo lo suyo.
drop policy if exists "notifications: select own" on public.notifications;
create policy "notifications: select own" on public.notifications
  for select using (auth.uid() = user_id);

-- Y solo puede marcarlo como leído.
drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- El cliente NO inserta avisos: los escriben las funciones del servidor.
-- Si pudiera insertarlos, cualquiera podría fabricarse un "te regalamos
-- 12 meses" y mandar una captura pidiendo que se lo cumplan.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Segundo cerrojo: aunque algún día se otorgue el GRANT de UPDATE
-- completo por error, este trigger impide cambiar el texto del aviso.
create or replace function public.notifications_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.caller_role() in ('authenticated', 'anon') then
    new.id         := old.id;
    new.user_id    := old.user_id;
    new.tipo       := old.tipo;
    new.icono      := old.icono;
    new.titulo     := old.titulo;
    new.cuerpo     := old.cuerpo;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_update on public.notifications;
create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function public.notifications_guard();


-- ------------------------------------------------------------
-- 2) Helper para crear un aviso
-- ------------------------------------------------------------
create or replace function public.notify_user(
  p_user uuid,
  p_tipo text,
  p_titulo text,
  p_cuerpo text default null,
  p_icono text default '🔔'
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, tipo, titulo, cuerpo, icono)
  values (p_user, p_tipo, left(p_titulo, 120), left(p_cuerpo, 400), p_icono);
$$;

revoke execute on function public.notify_user(uuid, text, text, text, text)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 3) Marcar todos como leídos (una llamada en vez de N)
-- ------------------------------------------------------------
create or replace function public.notifications_mark_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.notifications_mark_read() from public, anon;
grant execute on function public.notifications_mark_read() to authenticated;


-- ------------------------------------------------------------
-- 4) El regalo ahora avisa
--    Reemplaza la versión de la migración 13.
-- ------------------------------------------------------------
create or replace function public.admin_grant_premium(
  p_user uuid,
  p_meses int default 1,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  meses int := least(greatest(coalesce(p_meses, 1), 1), 24);
  motivo text := left(btrim(coalesce(p_motivo, '')), 200);
  nuevo timestamptz;
  mail text;
begin
  if not (
    public.is_admin()
    or public.caller_role() is null
    or public.caller_role() = 'service_role'
  ) then
    raise exception 'no autorizado';
  end if;

  select email into mail from auth.users where id = p_user;
  if mail is null then
    raise exception 'usuario inexistente';
  end if;

  update public.profiles
     set plan          = 'premium',
         premium_since = coalesce(premium_since, now()),
         premium_until = greatest(coalesce(premium_until, now()), now()) + (meses || ' month')::interval
   where id = p_user
  returning premium_until into nuevo;

  insert into public.admin_actions (admin_id, admin_email, action, target_id, target_email, detail)
  values (
    auth.uid(),
    coalesce((select email from auth.users where id = auth.uid()), 'SQL Editor'),
    'grant_premium',
    p_user,
    mail,
    jsonb_build_object('meses', meses, 'motivo', nullif(motivo, ''), 'premium_until', nuevo)
  );

  -- El aviso. El motivo se le muestra al usuario, así que escribilo
  -- pensando en que lo va a leer él, no como nota interna.
  perform public.notify_user(
    p_user,
    'regalo',
    '¡Te regalamos ' || meses || (case when meses = 1 then ' mes' else ' meses' end) || ' de premium!',
    case when motivo <> '' then motivo || ' ' else '' end
      || 'Tenés todas las funciones desbloqueadas hasta el '
      || to_char(nuevo, 'DD/MM/YYYY') || '. ¡Que lo disfrutes!',
    '🎁'
  );

  return jsonb_build_object('ok', true, 'premium_until', nuevo, 'meses', meses);
end;
$$;

revoke execute on function public.admin_grant_premium(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_premium(uuid, int, text) to authenticated;


-- ------------------------------------------------------------
-- 5) El premio por invitar también avisa
--    Reemplaza la versión de la migración 10.
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
  hasta timestamptz;
begin
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

  if n >= 3 then
    update public.profiles
       set plan          = 'premium',
           premium_since = coalesce(premium_since, now()),
           premium_until = greatest(coalesce(premium_until, now()), now()) + interval '3 months',
           referral_bonus_at = now()
     where id = r.referrer_id
       and referral_bonus_at is null
    returning premium_until into hasta;

    -- returning solo devuelve fila si el where se cumplió, o sea si el
    -- premio se otorgó recién ahora. Así no se avisa dos veces.
    if hasta is not null then
      perform public.notify_user(
        r.referrer_id,
        'referido',
        '¡Completaste tus 3 invitados: ganaste 3 meses de premium!',
        'Ya tenés todas las funciones desbloqueadas hasta el '
          || to_char(hasta, 'DD/MM/YYYY') || '. Gracias por recomendarnos.',
        '🎉'
      );
    end if;
  else
    -- Avisos de progreso: 1 de 3, 2 de 3.
    perform public.notify_user(
      r.referrer_id,
      'referido',
      'Se sumó un invitado (' || n || ' de 3)',
      case
        when n = 2 then 'Te falta uno solo para ganar tus 3 meses de premium.'
        else 'Cuando lleguen a 3, ganás 3 meses de premium.'
      end,
      '👤'
    );
  end if;
end;
$$;

revoke execute on function public.confirm_referral(uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 6) Verificación
-- ------------------------------------------------------------
-- Regalale 1 mes a una cuenta de prueba desde /admin y después:
--   select titulo, cuerpo, created_at from public.notifications
--    order by created_at desc limit 5;
--
-- Y comprobá que un usuario NO puede fabricarse avisos. Logueado con
-- una cuenta común, en la consola del navegador:
--   await supabase.from('notifications').insert({ titulo: 'trucho' })
--   → tiene que fallar con permission denied.

-- ============================================================
-- Fin de la migración 14
-- ============================================================
