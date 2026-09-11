-- ============================================================
-- CATI / NUMERA · Migración 32 · PAGOS DEL PRESUPUESTO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   Hoy el presupuesto tiene UN campo de anticipo (deposit) y muestra un
--   saldo. Alcanza para «50% y 50%», pero no para lo que pasa de verdad:
--
--     Seña: 10%
--     Anticipo de inicio: 40%
--     Saldo final: 50% contra entrega
--
--   Con un solo número no hay forma de decir «la seña ya la cobré, me
--   deben el 40% y el 50%», que es justamente lo que uno necesita mirar
--   cuando el cliente pregunta cuánto falta.
--
--   Esta columna guarda las etapas: cuánto es cada una, cuál ya se cobró,
--   cuándo, por qué medio y el comprobante que mandó el cliente.
--
-- POR QUÉ jsonb Y NO UNA TABLA
--   Las etapas no tienen vida propia: nacen, viven y mueren con el
--   presupuesto, nunca se consultan por separado y son tres o cuatro. Es
--   el mismo criterio que ya usan items, images y details.
--
--   Los recibos SÍ son una tabla (migración 06) y siguen estándolo: esos
--   son comprobantes numerados que se le entregan al cliente. Acá se
--   anota lo que el cliente PAGÓ; allá se emite lo que vos le DAS.
-- ============================================================

-- ------------------------------------------------------------
-- 1) La columna
-- ------------------------------------------------------------
alter table public.budgets add column if not exists pagos jsonb not null default '[]'::jsonb;

comment on column public.budgets.pagos is
  'Etapas de pago: [{label, percent, amount, paid_at, method, comprobante}]. '
  'paid_at en null significa que todavía no se cobró.';

-- ------------------------------------------------------------
-- 2) Validación
--    El comprobante es una URL que el navegador escribe en la base, así
--    que vale la misma regla que las imágenes: solo archivos de NUESTRO
--    Storage (migración 31). Si no, alguien podría dejar apuntando el
--    «comprobante» a cualquier lado y ese enlace se dibuja después en una
--    página servida desde nuestro dominio.
-- ------------------------------------------------------------
create or replace function public.pagos_ok(p jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  fila jsonb;
  comp text;
begin
  if p is null then
    return true;
  end if;
  if jsonb_typeof(p) <> 'array' then
    return false;
  end if;
  -- Doce etapas es muchísimo para un presupuesto; más que eso es basura
  -- o alguien probando cuánto aguanta la columna.
  if jsonb_array_length(p) > 12 then
    return false;
  end if;

  for fila in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(fila) <> 'object' then
      return false;
    end if;
    comp := fila->>'comprobante';
    if comp is not null and comp <> '' and not public.url_de_nuestro_storage(comp) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.budgets drop constraint if exists budgets_pagos_check;
alter table public.budgets add constraint budgets_pagos_check check (public.pagos_ok(pagos));

-- ------------------------------------------------------------
-- 3) Lo que NO cambia, a propósito
--    El RPC público (get_public_budget) devuelve el presupuesto con
--    to_jsonb menos algunas columnas, así que `pagos` va a salir por el
--    enlace del cliente. Es lo que queremos —que vea qué pagó y qué le
--    falta— PERO la app no dibuja ahí el enlace al comprobante: un
--    comprobante bancario tiene número de cuenta y el enlace público se
--    reenvía por WhatsApp. Ver PublicBudget.jsx.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4) Verificación
--    a) La columna existe:
--         select column_name from information_schema.columns
--          where table_name = 'budgets' and column_name = 'pagos';
--
--    b) Lo bueno pasa:
--         update public.budgets
--            set pagos = '[{"label":"Seña","percent":10,"amount":100,"paid_at":"2026-09-11"}]'::jsonb
--          where id = (select id from public.budgets limit 1);
--
--    c) Un comprobante de otro lado NO pasa:
--         update public.budgets
--            set pagos = '[{"label":"Seña","comprobante":"https://malo.com/x.pdf"}]'::jsonb
--          where id = (select id from public.budgets limit 1);
--       → tiene que FALLAR por budgets_pagos_check.
--
-- ⚠ Esta migración necesita la 31 corrida antes: usa
--   public.url_de_nuestro_storage().
-- ------------------------------------------------------------

-- ============================================================
-- Fin de la migración 32
-- ============================================================
