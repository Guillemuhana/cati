-- ============================================================
-- CATI / NUMERA · Migración 28 · EL ACUERDO NO VENCE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Aditiva y segura: no borra datos, y correrla dos veces no hace daño.
--
-- ⚠ REQUIERE la migración 27 corrida antes (usa public.ndas).
--
-- PARA QUÉ
--   La app ya no ofrece elegir plazo: todo acuerdo nuevo nace por tiempo
--   indefinido. Pero los acuerdos creados con la versión anterior
--   quedaron con su plazo en años guardado en la fila, y ese es el que
--   sigue apareciendo en pantalla y en el PDF («por 2 años»). Esto los
--   pasa a tiempo indefinido.
--
-- ⚠ QUÉ NO TOCA, Y POR QUÉ
--   No toca los acuerdos que la otra parte YA FIRMÓ. Lo que se firmó es
--   lo que quedó escrito: cambiarle el plazo a un acuerdo firmado sería
--   reescribir un documento a espaldas de quien lo firmó, y además
--   rompería la huella SHA-256 que lo ancla. Si alguno de esos hace
--   falta cambiarlo, se anula y se manda uno nuevo.
--   (El propio trigger ndas_guard de la migración 27 lo impide.)
-- ============================================================

do $freno$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'ndas') then
    raise exception 'Falta la migración 27 (public.ndas). Corré esa primero.';
  end if;
end
$freno$;


-- ------------------------------------------------------------
-- 1) El plazo, en la fila: es el que se lee en la lista, en la ficha y
--    en el link público. 0 = por tiempo indefinido.
-- ------------------------------------------------------------
alter table public.ndas alter column vigencia_anios set default 0;

update public.ndas
   set vigencia_anios = 0
 where vigencia_anios > 0
   and firmado_parte_at is null;


-- ------------------------------------------------------------
-- 2) El plazo, dentro del texto congelado. La cláusula NOVENA del
--    acuerdo viejo decía «por el plazo de N años»; se reemplaza entera
--    por la que usa hoy el código (src/lib/nda.js), palabra por palabra.
--
--    El límite del reemplazo es el título de la cláusula siguiente, así
--    no se come el resto del acuerdo.
-- ------------------------------------------------------------
update public.ndas
   set cuerpo = regexp_replace(
         cuerpo,
         'NOVENA — PLAZO\..*?DÉCIMA — INCUMPLIMIENTO',
         'NOVENA — PLAZO. Las obligaciones de confidencialidad rigen desde la firma del presente y se mantienen por tiempo indefinido, mientras la información conserve carácter confidencial conforme a la cláusula CUARTA. Subsisten aun cuando no llegara a celebrarse contrato alguno entre las Partes, aunque el proyecto no se lleve a cabo, y con independencia del motivo por el cual finalicen las conversaciones.'
         || E'\n\n' || 'DÉCIMA — INCUMPLIMIENTO'
       )
 where firmado_parte_at is null
   and cuerpo like '%NOVENA — PLAZO. Las obligaciones de confidencialidad rigen desde la firma del presente y se mantienen por el plazo de %';


-- ------------------------------------------------------------
-- 3) La huella vuelve a coincidir con el texto. Se calcula sobre el
--    cuerpo tal cual está guardado —con el hueco [[PARTE_B]] incluido,
--    que es lo que hace el navegador al crear el acuerdo—; al firmar,
--    sign_nda la vuelve a calcular sobre el texto ya completo.
--    Si pgcrypto no está a mano, se deja como estaba: la firma la
--    recalcula igual y la base sigue siendo la que responde por lo que
--    quedó escrito.
-- ------------------------------------------------------------
do $huella$
begin
  update public.ndas
     set huella = btrim(regexp_replace(
           encode(digest(cuerpo, 'sha256'), 'hex'), '(.{8})', '\1 ', 'g'
         ))
   where firmado_parte_at is null
     and cuerpo <> '';
exception when others then
  raise notice 'pgcrypto no disponible: la huella se recalcula al firmar';
end
$huella$;
