-- ============================================================
-- CATI / NUMERA · Migración 24 · VISTA PREVIA DEL ENLACE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- PARA QUÉ
--   Cuando el usuario manda el enlace del presupuesto por WhatsApp, el
--   que lo recibe ve una tarjetita de vista previa. Hoy dice «Numera ·
--   Presupuestos profesionales…», que es nuestro cartel, no el suyo.
--   Con esto pasa a decir el nombre de SU negocio y a mostrar SU logo.
--
--   El robot de WhatsApp no ejecuta JavaScript: solo lee el HTML que
--   le llega. Por eso hay una función en el servidor (api/preview.js)
--   que arma ese HTML, y necesita estos datos sin estar logueada.
--
-- POR QUÉ UNA FUNCIÓN NUEVA Y NO get_public_budget
--   Dos razones, las dos importantes:
--
--   1. get_public_budget marca el presupuesto como VISTO. Si la usara
--      la vista previa, el presupuesto figuraría visto por el robot de
--      WhatsApp apenas se pega el link, antes de que el cliente lo
--      abra. El usuario vería «Visto» y no sería verdad.
--
--   2. La vista previa la ve cualquiera en el grupo de WhatsApp donde
--      se pegó el link. Por eso acá NO va el nombre del cliente, ni el
--      total, ni los ítems: solo el nombre del negocio, su logo y el
--      número. Los datos del trabajo siguen detrás del link.
-- ============================================================

create or replace function public.get_public_budget_meta(p_token uuid)
returns jsonb
language plpgsql
security definer
stable                      -- no escribe nada: no marca visto
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
  -- suscripción activa, el link no sirve y la previa tampoco.
  if not public.is_premium(b.user_id) then
    return null;
  end if;

  return (
    select jsonb_build_object(
      -- Ya formateado como lo muestra el PDF (PRES-2026-0014), para que
      -- la previa y el documento digan exactamente lo mismo.
      'numero',        coalesce(nullif(p.number_prefix, ''), 'PRES')
                       || '-' || extract(year from b.issue_date)::int
                       || '-' || lpad(b.numero::text, 4, '0'),
      'business_name', p.business_name,
      'logo_url',      p.logo_url,
      'brand_color',   p.brand_color,
      'hide_branding', p.hide_branding
    )
    from public.profiles p where p.id = b.user_id
  );
end;
$$;

revoke execute on function public.get_public_budget_meta(uuid) from public;
grant  execute on function public.get_public_budget_meta(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
-- a) Devuelve solo la marca, nada del cliente ni plata:
--      select public.get_public_budget_meta('<token>');
--
-- b) No marca visto. Con un presupuesto en 'enviado':
--      select public.get_public_budget_meta('<token>');
--      select status, viewed_at from public.budgets where public_token = '<token>';
--    → tiene que seguir en 'enviado' y con viewed_at en null.
--
-- c) Token inventado → null:
--      select public.get_public_budget_meta(gen_random_uuid());

-- ============================================================
-- Fin de la migración 24
-- ============================================================
