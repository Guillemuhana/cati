import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { usePlan } from '../hooks/usePlan'
import { formatDate, avisarMigracion } from '../lib/utils'
import { FREE_FOR_ALL, FREE_UNTIL_LABEL, PROMO_LABEL } from '../lib/config'

// Donde el usuario ve y da de baja SUS suscripciones. No es una página
// nuestra: la lista la maneja Mercado Pago, que es quien cobra.
const PANEL_MP = 'https://www.mercadopago.com.ar/subscriptions'

/**
 * El estado de la suscripción propia.
 *
 * La página de planes vende; esto le contesta al que ya paga las tres
 * preguntas que se hace cuando ve el débito en el resumen: qué tengo,
 * hasta cuándo, y cómo lo doy de baja.
 *
 * Lo de dar de baja va a Mercado Pago a propósito. Podríamos poner un
 * botón que cancele desde acá, pero entonces la baja dependería de que
 * nuestro servidor funcione ese día. Que el que cobra sea el que da de
 * baja es más lento de explicar y mucho más difícil de romper.
 */
export default function MiSuscripcion() {
  const { t } = useTranslation()
  const { isPaid, trialActive, trialLeftLabel, premiumUntil } = usePlan()
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let vivo = true
    supabase.rpc('mi_suscripcion').then(({ data, error: err }) => {
      if (!vivo) return
      if (err) {
        // Sin esto —la migración 37 sin correr, por ejemplo— el panel
        // igual sirve: el estado y la renovación salen del perfil que
        // ya está cargado. Lo único que falta es el historial, y por
        // eso no se le tira al usuario un cartel rojo que no puede
        // resolver.
        avisarMigracion('migration_37_mi_suscripcion.sql', err.message)
        return
      }
      setDatos(data)
    })
    return () => {
      vivo = false
    }
  }, [])

  const pagos = Array.isArray(datos?.pagos) ? datos.pagos : []

  // Qué decir del estado, en el orden en que importa: primero lo que
  // vale hoy, después lo que va a valer.
  const estado = isPaid
    ? { texto: t('suscripcion.activa'), tono: 'teal' }
    : trialActive
      ? { texto: t('suscripcion.enPrueba', { promo: PROMO_LABEL, restante: trialLeftLabel }), tono: 'brand' }
      : FREE_FOR_ALL
        ? { texto: t('suscripcion.gratisPorAhora'), tono: 'brand' }
        : { texto: t('suscripcion.sinPlan'), tono: 'soft' }

  const tonos = {
    teal: 'border-teal-500/40 bg-teal-500/[0.08] text-teal-700',
    brand: 'border-brand-500/40 bg-brand-500/[0.07] text-brand-700',
    soft: 'border-line bg-paper text-ink-soft'
  }

  return (
    <section className="rounded-xl2 border border-line bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-medium text-ink">{t('suscripcion.titulo')}</h2>
          <p className="mt-0.5 text-xs text-ink-soft">{t('suscripcion.bajada')}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tonos[estado.tono]}`}>
          {estado.texto}
        </span>
      </div>

      <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
        {FREE_FOR_ALL && (
          <Fila etiqueta={t('suscripcion.gratisHasta')} valor={FREE_UNTIL_LABEL} />
        )}
        {datos?.premium_since && (
          <Fila etiqueta={t('suscripcion.desde')} valor={soloFecha(datos.premium_since)} />
        )}
        {isPaid && premiumUntil && (
          <Fila etiqueta={t('suscripcion.proximaRenovacion')} valor={soloFecha(premiumUntil)} />
        )}
        {!isPaid && trialActive && datos?.trial_ends_at && (
          <Fila etiqueta={t('suscripcion.pruebaHasta')} valor={soloFecha(datos.trial_ends_at)} />
        )}
      </dl>

      {/* Los cobros que entraron de verdad. Vacío no es un error: es un
          usuario que todavía no pagó ninguno. */}
      {pagos.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {t('suscripcion.historial')}
          </p>
          <ul className="divide-y divide-line border-y border-line">
            {pagos.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">{soloFecha(p.fecha)}</span>
                <span className="text-xs text-teal-600">{t('suscripcion.acreditado')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isPaid && (
        <div className="mt-5">
          <a
            href={PANEL_MP}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:border-ink-faint"
          >
            {t('suscripcion.gestionar')}
          </a>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{t('suscripcion.gestionarAyuda')}</p>
        </div>
      )}
    </section>
  )
}

function Fila({ etiqueta, valor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-ink-soft">{etiqueta}</dt>
      <dd className="font-medium text-ink">{valor}</dd>
    </div>
  )
}

/** Las fechas vienen con hora de la base; acá solo importa el día. */
function soloFecha(valor) {
  if (!valor) return ''
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '' : formatDate(d.toISOString().slice(0, 10))
}
