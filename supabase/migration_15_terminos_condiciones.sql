-- ============================================================
-- CATI · Migración 15 · Términos y condiciones del negocio
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- Cada usuario puede escribir un texto legal propio (garantía,
-- política de cancelación, letra chica…) que se imprime al final
-- del PDF y del enlace público. Es opcional: si está vacío no
-- aparece nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columna nueva en profiles
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists legal_terms text default '';

-- ------------------------------------------------------------
-- 2) Permiso de escritura a nivel columna
--    (migración 07 revocó el UPDATE general sobre profiles, así
--     que un campo nuevo no es editable hasta que se lo agrega acá)
-- ------------------------------------------------------------
grant update (legal_terms) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 3) El enlace público tiene que devolver el texto
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
        'logo_url', p.logo_url,
        'email', p.email,
        'phone', p.phone,
        'tax_id', p.tax_id,
        'address', p.address,
        'bank_alias', p.bank_alias,
        'brand_color', p.brand_color,
        'hide_branding', p.hide_branding,
        'legal_terms', p.legal_terms
      )
      from public.profiles p where p.id = b.user_id
    )
  );
end;
$$;

grant execute on function public.get_public_budget(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 4) Verificación
-- ------------------------------------------------------------
-- Logueado con una cuenta común, en la consola del navegador:
--   await supabase.from('profiles').update({ legal_terms: 'Prueba' }).eq('id', (await supabase.auth.getUser()).data.user.id)
--   → tiene que funcionar.
--   await supabase.from('profiles').update({ plan: 'premium' }).eq('id', ...)
--   → tiene que seguir fallando con permission denied.

-- ============================================================
-- Fin de la migración 15
-- ============================================================
