import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { usePlan } from '../hooks/usePlan'
import {
  FREE_FOR_ALL,
  PAYMENT_URL,
  PREMIUM_PRICE,
  PREMIUM_PRICE_FULL,
  PREMIUM_FEATURES,
  PROMO_LABEL,
  FREE_UNTIL_LABEL,
  freeDaysLeft
} from '../lib/config'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'

export default function Premium() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { isPaid, trialActive, trialLeftLabel, premiumUntil } = usePlan()

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 text-center">
        <img src="/numera-icon.png" alt="" className="mx-auto mb-3 h-20 w-20" />
        <h1 className="font-display text-3xl font-medium text-ink">{t('premium.titulo')}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t('premium.bajada')}</p>
      </header>

      {/* Estado del plan */}
      <div className="mb-6 rounded-xl2 border border-line bg-surface p-5 text-center shadow-soft">
        {FREE_FOR_ALL ? (
          <p className="text-sm text-ink-soft">
            <Trans
              i18nKey="premium.todoGratis"
              values={{
                fecha: FREE_UNTIL_LABEL,
                precio: PREMIUM_PRICE_FULL,
                dias: freeDaysLeft()
              }}
              components={[
                <span key="0" />,
                <b key="1" className="text-teal-600" />,
                <span key="2" />,
                <b key="3" className="text-ink" />
              ]}
            />
          </p>
        ) : isPaid ? (
          <p className="text-sm font-medium text-teal-600">
            {premiumUntil
              ? t('premium.activaHasta', {
                  fecha: formatDate(new Date(premiumUntil).toISOString().slice(0, 10))
                })
              : t('premium.activa')}
          </p>
        ) : trialActive ? (
          <p className="text-sm text-ink-soft">
            <Trans
              i18nKey="premium.enPrueba"
              values={{ promo: PROMO_LABEL, restante: trialLeftLabel }}
              components={[
                <span key="0" />,
                <b key="1" />,
                <span key="2" />,
                <span key="3" className="font-semibold text-brand-700" />
              ]}
            />
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            {t('premium.termino', { precio: PREMIUM_PRICE_FULL })}
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Beneficios */}
        <div className="rounded-xl2 border border-line bg-surface p-6 shadow-soft">
          <h2 className="font-display text-base font-medium text-ink">{t('premium.queIncluye')}</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-0.5 text-teal-500">✓</span>
                <span>{t(f)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Precio / pago */}
        <div className="flex flex-col rounded-xl2 border-2 border-brand-500/30 bg-gradient-to-br from-brand-500/[0.06] to-brass-400/[0.10] p-6 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {FREE_FOR_ALL ? t('premium.precioLanzamiento') : t('premium.suscripcionMensual')}
          </p>
          <p className="mt-1 font-display text-4xl font-semibold text-brand-700">
            {FREE_FOR_ALL ? (
              t('premium.gratis')
            ) : (
              <>
                {PREMIUM_PRICE}
                <span className="text-lg font-medium text-ink-soft">{t('premium.porMes')}</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {FREE_FOR_ALL
              ? t('premium.sinCostoHasta', { fecha: FREE_UNTIL_LABEL, precio: PREMIUM_PRICE_FULL })
              : t('premium.primerosGratis', { promo: PROMO_LABEL })}
          </p>

          {FREE_FOR_ALL ? (
            <div className="mt-6 rounded-md bg-teal-500/10 px-4 py-3 text-center text-sm font-medium text-teal-600">
              {t('premium.yaDesbloqueado')}
            </div>
          ) : isPaid ? (
            <div className="mt-6 rounded-md bg-teal-500/10 px-4 py-3 text-center text-sm font-medium text-teal-600">
              {t('premium.suscripcionActiva')}
            </div>
          ) : PAYMENT_URL ? (
            <a
              href={PAYMENT_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-6 rounded-md py-3 text-center text-sm font-semibold"
            >
              {t('premium.suscribirmePor', { precio: PREMIUM_PRICE_FULL })}
            </a>
          ) : (
            <button disabled className="mt-6 cursor-not-allowed rounded-md bg-ink/10 py-3 text-center text-sm font-semibold text-ink-faint">
              {t('premium.pagoProximamente')}
            </button>
          )}

          <p className="mt-3 text-xs text-ink-faint">
            {FREE_FOR_ALL
              ? t('premium.notaGratis')
              : PAYMENT_URL
                ? t('premium.notaPago')
                : t('premium.notaSinPago')}
          </p>
          {user?.email && (
            <p className="mt-2 break-all text-[11px] text-ink-faint">
              {t('premium.tuCuenta', { email: user.email })}
            </p>
          )}
        </div>
      </div>

      <Link
        to="/invitar"
        className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-dashed border-teal-500/40 bg-teal-500/[0.05] px-5 py-4 transition hover:bg-teal-500/[0.09]"
      >
        <span className="text-sm text-ink-soft">
          <Trans
            i18nKey="premium.invitaGana"
            components={[<span key="0" />, <b key="1" className="text-ink" />]}
          />
        </span>
        <span className="text-sm font-medium text-teal-600">{t('premium.verMiLink')}</span>
      </Link>
    </div>
  )
}
