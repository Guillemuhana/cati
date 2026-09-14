-- ============================================================
-- CATI / NUMERA · Migración 37 · MI SUSCRIPCIÓN
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
--
-- QUÉ RESUELVE
--   La página de planes es una página de venta: dice cuánto sale y
--   ofrece pagar. No hay ningún lugar donde el que YA paga vea qué
--   tiene contratado, hasta cuándo, ni qué le cobraron.
--
--   Cuando a alguien le llega el resumen de la tarjeta y no se acuerda
--   qué es ese débito, lo que hace es escribir o dar de baja. Esta
--   función es para que pueda mirarlo solo.
--
-- POR QUÉ UNA FUNCIÓN Y NO LEER LAS TABLAS
--   Los pagos viven en mp_eventos, que está cerrada a cal y canto: sus
--   filas tienen el mail y el id de Mercado Pago de OTRA gente. Una
--   política de RLS que abriera esa tabla «pero solo tus filas» es fácil
--   de escribir mal una vez y filtrar todo.
--
--   Acá en cambio se devuelve una lista armada, con las cuatro cosas
--   que el usuario necesita ver de SUS propios pagos, y nada más.
-- ============================================================

create or replace function public.mi_suscripcion()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_perfil public.profiles;
begin
  if v_user is null then
    raise exception 'no autorizado';
  end if;

  select * into v_perfil from public.profiles where id = v_user;

  return jsonb_build_object(
    'plan',          coalesce(v_perfil.plan, 'free'),
    'premium_since', v_perfil.premium_since,
    'premium_until', v_perfil.premium_until,
    'trial_ends_at', v_perfil.trial_ends_at,
    -- Solo los cobros que se acreditaron. Un intento rechazado o una
    -- notificación que no se pudo resolver no son «pagos»: mostrarlos
    -- acá asustaría sin motivo.
    'pagos', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'fecha',  e.created_at,
                   'estado', e.estado_mp,
                   'plan',   e.plan_id,
                   'hasta',  e.detalle
                 )
                 order by e.created_at desc
               )
        from public.mp_eventos e
        where e.user_id = v_user
          and e.resuelto
          and e.estado_mp in ('authorized', 'approved', 'accredited')
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.mi_suscripcion() from public, anon;
grant execute on function public.mi_suscripcion() to authenticated;

-- ------------------------------------------------------------
-- Verificación
--   a) Como usuario logueado, devuelve TU plan y TUS pagos:
--        select public.mi_suscripcion();
--
--   b) Sin sesión, falla:
--        (desde la pestaña SQL corre como admin, así que esto se
--         comprueba de verdad desde la app, no desde acá)
--
--   c) Nunca devuelve pagos de otro:
--        select jsonb_array_length(public.mi_suscripcion() -> 'pagos');
--      → como mucho, la cantidad de filas que mp_eventos tiene con tu
--        user_id.
-- ============================================================
-- Fin de la migración 37
-- ============================================================
