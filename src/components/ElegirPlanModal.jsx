import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  PAYMENT_URL,
  PAYMENT_URL_YEAR,
  PREMIUM_PRICE_FULL,
  PREMIUM_PRICE_YEAR_FULL,
  PREMIUM_FEATURES,
  TRIAL_DAYS
} from '../lib/config'

/**
 * Los planes, apenas se registra.
 *
 * Se muestra una sola vez y se puede cerrar con la ✕: el que cierra
 * arranca sus días de prueba con todo desbloqueado, que es lo que ya le
 * dio la base al crear la cuenta. O sea que la ✕ no lo deja afuera de
 * nada, y por eso el texto de abajo se lo dice antes de que la toque.
 *
 * Un modal de precios que no se puede cerrar hace que la mitad se vaya
 * sin ver la app. Uno que se cierra y aclara qué pasa después convierte
 * peor en el momento y mucho mejor a los tres días, cuando la persona
 * ya hizo un presupuesto y sabe si le sirve.
 */
export default function ElegirPlanModal({ onCerrar }) {
  const { t } = useTranslation()
  const { user } = useAuth()

  // El id viaja al checkout para que el webhook sepa a quién activarle
  // el premium cuando Mercado Pago avise que se pagó.
  const conReferencia = (url) => {
    if (!url || !user?.id) return url
    return `${url}${url.includes('?') ? '&' : '?'}external_reference=${encodeURIComponent(user.id)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-xl2 bg-surface p-6 shadow-soft sm:rounded-xl2">
        <button
          type="button"
          onClick={onCerrar}
          aria-label={t('elegirPlan.cerrar')}
          className="absolute right-3 top-3 rounded-md p-1.5 text-ink-faint transition hover:bg-ink/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <img src="/numera-icon.png" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h2 className="text-center font-display text-xl font-medium text-ink">{t('elegirPlan.titulo')}</h2>
        <p className="mt-1 text-center text-sm text-ink-soft">{t('elegirPlan.bajada')}</p>

        <ul className="mt-4 space-y-1.5 rounded-lg border border-line bg-paper/60 p-3 text-xs text-ink-soft">
          {PREMIUM_FEATURES.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-px text-teal-500">✓</span>
              <span>{t(f)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2">
          <Plan
            titulo={t('elegirPlan.anual')}
            precio={PREMIUM_PRICE_YEAR_FULL}
            detalle={t('elegirPlan.anualDetalle')}
            url={conReferencia(PAYMENT_URL_YEAR)}
            destacado
            cta={t('elegirPlan.elegir')}
            sinPago={t('elegirPlan.sinPago')}
          />
          <Plan
            titulo={t('elegirPlan.mensual')}
            precio={PREMIUM_PRICE_FULL}
            url={conReferencia(PAYMENT_URL)}
            cta={t('elegirPlan.elegir')}
            sinPago={t('elegirPlan.sinPago')}
          />
        </div>

        {/* Lo que pasa si toca la ✕, dicho ANTES de que la toque. */}
        <button
          type="button"
          onClick={onCerrar}
          className="mt-4 w-full rounded-md py-2 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          {t('elegirPlan.probarPrimero', { dias: TRIAL_DAYS })}
        </button>
      </div>
    </div>
  )
}

function Plan({ titulo, precio, detalle, url, destacado, cta, sinPago }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        destacado ? 'border-brand-500/50 bg-brand-500/[0.05]' : 'border-line'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{titulo}</span>
        <span className="font-mono text-sm font-semibold text-ink">{precio}</span>
      </div>
      {detalle && <p className="mt-0.5 text-[11px] text-brand-700">{detalle}</p>}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`mt-2.5 block rounded-md py-2 text-center text-xs font-semibold transition ${
            destacado
              ? 'btn-primary text-white'
              : 'border border-line text-ink hover:border-ink-faint'
          }`}
        >
          {cta}
        </a>
      ) : (
        <p className="mt-2.5 rounded-md bg-ink/[0.04] py-2 text-center text-xs font-medium text-ink-faint">
          {sinPago}
        </p>
      )}
    </div>
  )
}
