-- ============================================================
-- CATI / NUMERA · Migración 22 · DATOS DEL TRABAJO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ AGREGA
--   Cada presupuesto puede llevar hasta 8 datos sueltos del trabajo,
--   con el nombre que le ponga el usuario:
--
--     Fecha del evento · Sábado 14/03
--     Lugar            · Salón Las Lomas, Pilar
--     Horas de cobertura · 6
--
--   El rubro sugiere los que se usan en ese oficio (un fotógrafo ve
--   «Fecha del evento», un taller ve «Patente»), pero son todos
--   opcionales y el usuario puede inventar los suyos.
--
--   Aparecen en el PDF debajo de los datos del cliente, y en el
--   enlace público. Si no cargó ninguno, no se imprime nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Columna nueva en budgets
--    Array JSON de pares: [{"label": "...", "value": "..."}]
--    Es un array y no un objeto porque el ORDEN importa: se imprime
--    en el mismo orden en que el usuario los cargó.
--    El enlace público devuelve to_jsonb(budget), así que este campo
--    viaja solo: no hay que tocar get_public_budget.
-- ------------------------------------------------------------
alter table public.budgets
  add column if not exists details jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
-- 2) Validación
--    Lo escribe el usuario y no solo desde el formulario: con su
--    token puede mandar cualquier cosa por la API. Acá se acota la
--    forma y el tamaño; el contenido es texto y se muestra como
--    texto (React escapa), nunca como HTML.
-- ------------------------------------------------------------
create or replace function public.details_ok(d jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  item jsonb;
begin
  if d is null then
    return true;
  end if;
  if jsonb_typeof(d) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(d) > 8 then
    return false;
  end if;
  for item in select jsonb_array_elements(d) loop
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;
    if jsonb_typeof(item->'label') <> 'string' or jsonb_typeof(item->'value') <> 'string' then
      return false;
    end if;
    if length(item->>'label') > 40 or length(item->>'value') > 200 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.budgets drop constraint if exists budgets_details_check;
alter table public.budgets add constraint budgets_details_check
  check (public.details_ok(details));

-- ------------------------------------------------------------
-- 3) Verificación
-- ------------------------------------------------------------
-- a) La forma buena entra:
--      update public.budgets
--         set details = '[{"label":"Fecha del evento","value":"Sábado 14/03"}]'::jsonb
--       where id = (select id from public.budgets limit 1);
--    → funciona. (Después dejalo en '[]'.)
--
-- b) La basura no:
--      update public.budgets set details = '[{"label":"x"}]'::jsonb
--       where id = (select id from public.budgets limit 1);
--    → tiene que FALLAR por budgets_details_check (falta "value").
--
--      update public.budgets set details = '"hola"'::jsonb
--       where id = (select id from public.budgets limit 1);
--    → tiene que FALLAR (no es un array).

-- ============================================================
-- Fin de la migración 22
-- ============================================================
