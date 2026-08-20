-- ============================================================
-- CATI / NUMERA · Migración 23 · CONTACTO, REDES Y AVISO DE RESPUESTA
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Requiere la migración 14 (notificaciones) corrida antes.
--
-- QUÉ AGREGA
--   1. El negocio puede cargar sitio web, WhatsApp, Instagram,
--      Facebook, TikTok, YouTube y X. (Teléfono, email y dirección
--      ya existían.) Aparecen en el enlace público y en el PDF, con
--      el ícono de cada red y en un solo toque desde el celular.
--   2. Cuando el cliente ACEPTA o RECHAZA desde el enlace público, al
--      dueño le entra un aviso en la campanita. Hasta ahora se
--      enteraba solo si volvía a mirar el presupuesto.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columnas nuevas en profiles
--    Se guarda lo que el usuario escribe («@minegocio», «11 5555-4444»).
--    La URL la arma el navegador con el dominio fijo en el código, para
--    que no pueda entrar un «javascript:...» en un enlace del PDF o de
--    la página pública. Ver src/lib/redes.js.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists website   text default '';
alter table public.profiles add column if not exists whatsapp  text default '';
alter table public.profiles add column if not exists instagram text default '';
alter table public.profiles add column if not exists facebook  text default '';
alter table public.profiles add column if not exists tiktok    text default '';
alter table public.profiles add column if not exists youtube   text default '';
alter table public.profiles add column if not exists x         text default '';

-- ------------------------------------------------------------
-- 2) Permiso de escritura a nivel columna
--    (la migración 07 revocó el UPDATE general sobre profiles: un
--     campo nuevo no es editable hasta que se lo agrega acá)
-- ------------------------------------------------------------
grant update (website, whatsapp, instagram, facebook, tiktok, youtube, x)
  on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3) El enlace público tiene que devolver el contacto
--    Es la función de la migración 15 con los campos nuevos en el
--    bloque `business`. El resto queda igual: sigue sin exponer
--    user_id ni el token, y sigue marcando «visto» la primera vez.
-- ------------------------------------------------------------
create or replace function public.get_public_budget(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.budgets;
begin
  select * into b from public.budgets where public_token = p_token;
  if not found then
    return null;
  end if;

  -- El enlace público es función premium: si el dueño no tiene
  -- suscripción activa, el link deja de servir.
  if not public.is_premium(b.user_id) then
    return null;
  end if;

  if b.viewed_at is null then
    update public.budgets
      set viewed_at = now(),
          status = case when status = 'enviado' then 'visto' else status end
      where id = b.id;
    select * into b from public.budgets where id = b.id;
  end if;

  return jsonb_build_object(
    -- Nunca exponemos user_id ni el token secreto al HTML público.
    'budget', to_jsonb(b) - 'user_id' - 'public_token',
    'items', coalesce(
      (select jsonb_agg(to_jsonb(i) - 'budget_id' order by i.position)
         from public.budget_items i where i.budget_id = b.id),
      '[]'::jsonb
    ),
    'business', (
      select jsonb_build_object(
        'business_name', p.business_name,
        'logo_url',      p.logo_url,
        'email',         p.email,
        'phone',         p.phone,
        'tax_id',        p.tax_id,
        'address',       p.address,
        'bank_alias',    p.bank_alias,
        'brand_color',   p.brand_color,
        'hide_branding', p.hide_branding,
        'legal_terms',   p.legal_terms,
        'website',       p.website,
        'whatsapp',      p.whatsapp,
        'instagram',     p.instagram,
        'facebook',      p.facebook,
        'tiktok',        p.tiktok,
        'youtube',       p.youtube,
        'x',             p.x
      )
      from public.profiles p where p.id = b.user_id
    )
  );
end;
$$;

grant execute on function public.get_public_budget(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 4) Aviso cuando el cliente responde
--    Es la función de la migración 07 con el INSERT del aviso. Va acá
--    y no en el navegador por dos razones: el que acepta no tiene
--    cuenta (no puede escribir en notifications, y está bien que no
--    pueda), y así el aviso queda atado a la misma transacción que el
--    cambio de estado: o pasan las dos cosas o no pasa ninguna.
-- ------------------------------------------------------------
create or replace function public.set_budget_response(p_token uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.budgets;
  cliente text;
begin
  if p_action not in ('aceptado', 'rechazado') then
    raise exception 'accion invalida';
  end if;

  select * into b from public.budgets where public_token = p_token;
  if not found then
    return null;
  end if;

  if not public.is_premium(b.user_id) then
    return null;
  end if;

  -- Una vez que el cliente decidió, la decisión queda congelada.
  if b.status in ('aceptado', 'rechazado') then
    return jsonb_build_object('ok', false, 'status', b.status, 'reason', 'ya_respondido');
  end if;

  update public.budgets
    set status = p_action,
        accepted_at = case when p_action = 'aceptado' then now() else accepted_at end,
        rejected_at = case when p_action = 'rechazado' then now() else rejected_at end
    where id = b.id
    returning * into b;

  select coalesce(c.name, 'El cliente') into cliente
    from public.clients c where c.id = b.client_id;

  insert into public.notifications (user_id, tipo, icono, titulo, cuerpo)
  values (
    b.user_id,
    'presupuesto',
    case when p_action = 'aceptado' then '✅' else '❌' end,
    case
      when p_action = 'aceptado'
      then coalesce(cliente, 'El cliente') || ' aceptó tu presupuesto'
      else coalesce(cliente, 'El cliente') || ' rechazó tu presupuesto'
    end,
    'Presupuesto N° ' || b.numero ||
    case when b.title is not null and b.title <> '' then ' · ' || b.title else '' end
  );

  return jsonb_build_object('ok', true, 'status', b.status);
end;
$$;

grant execute on function public.set_budget_response(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5) Que el aviso llegue sin recargar
--    Con la tabla en la publicación de realtime, la campanita se
--    entera en el momento. Si esto falla porque la publicación no
--    existe en tu proyecto, no pasa nada: el aviso igual queda
--    guardado y aparece al abrir la app.
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;  -- ya estaba
  when undefined_object then null;  -- no hay publicación realtime
end
$$;

-- ------------------------------------------------------------
-- 6) Verificación
-- ------------------------------------------------------------
-- a) Las columnas nuevas se pueden guardar: entrá a «Mi negocio»,
--    cargá Instagram y WhatsApp, y guardá.
--
-- b) El enlace público las devuelve:
--      select public.get_public_budget('<token de un presupuesto>');
--    → en 'business' tienen que estar website/whatsapp/instagram…
--
-- c) El aviso: abrí un presupuesto compartido en incógnito, tocá
--    «Aceptar», y volvé a la app. Tiene que estar la campanita con
--    «... aceptó tu presupuesto».
--    Para probarlo de nuevo con el mismo presupuesto, volvé a ponerlo
--    en 'enviado':
--      update public.budgets set status = 'enviado', accepted_at = null
--       where id = '...';

-- ============================================================
-- Fin de la migración 23
-- ============================================================
