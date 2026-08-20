import { Link } from 'react-router-dom'
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
  const { user } = useAuth()
  const { isPaid, trialActive, trialLeftLabel, premiumUntil } = usePlan()

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 text-center">
        <img src="/numera-icon.png" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h1 className="font-display text-3xl font-medium text-ink">Numera Premium</h1>
        <p className="mt-1 text-sm text-ink-soft">Todo lo que necesitás para cerrar más presupuestos.</p>
      </header>

      {/* Estado del plan */}
      <div className="mb-6 rounded-xl2 border border-line bg-surface p-5 text-center shadow-soft">
        {FREE_FOR_ALL ? (
          <p className="text-sm text-ink-soft">
            🎉 Todas las funciones están <b className="text-teal-600">gratis y desbloqueadas</b>, sin
            tarjeta, hasta el <b className="text-ink">{FREE_UNTIL_LABEL}</b>. Después sigue por{' '}
            {PREMIUM_PRICE_FULL}. Faltan {freeDaysLeft()} días.
          </p>
        ) : isPaid ? (
          <p className="text-sm font-medium text-teal-600">
            ✓ Suscripción activa{premiumUntil ? ` hasta el ${formatDate(new Date(premiumUntil).toISOString().slice(0, 10))}` : ''}. ¡Gracias!
          </p>
        ) : trialActive ? (
          <p className="text-sm text-ink-soft">
            Estás en tus <b>{PROMO_LABEL} gratis</b>. Te quedan{' '}
            <span className="font-semibold text-brand-700">{trialLeftLabel}</span> con todo desbloqueado.
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            Tu período gratis terminó. Seguí con todo desbloqueado por {PREMIUM_PRICE_FULL}.
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Beneficios */}
        <div className="rounded-xl2 border border-line bg-surface p-6 shadow-soft">
          <h2 className="font-display text-base font-medium text-ink">Qué incluye</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-ink-soft">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-0.5 text-teal-500">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Precio / pago */}
        <div className="flex flex-col rounded-xl2 border-2 border-brand-500/30 bg-gradient-to-br from-brand-500/[0.06] to-brass-400/[0.10] p-6 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {FREE_FOR_ALL ? 'Precio de lanzamiento' : 'Suscripción mensual'}
          </p>
          <p className="mt-1 font-display text-4xl font-semibold text-brand-700">
            {FREE_FOR_ALL ? (
              'Gratis'
            ) : (
              <>
                {PREMIUM_PRICE}
                <span className="text-lg font-medium text-ink-soft"> /mes</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {FREE_FOR_ALL
              ? `Sin costo hasta el ${FREE_UNTIL_LABEL}. A partir de esa fecha, ${PREMIUM_PRICE_FULL}.`
              : `Primeros ${PROMO_LABEL} gratis · Cancelás cuando quieras.`}
          </p>

          {FREE_FOR_ALL ? (
            <div className="mt-6 rounded-md bg-teal-500/10 px-4 py-3 text-center text-sm font-medium text-teal-600">
              Ya tenés todo desbloqueado ✓
            </div>
          ) : isPaid ? (
            <div className="mt-6 rounded-md bg-teal-500/10 px-4 py-3 text-center text-sm font-medium text-teal-600">
              Suscripción activa ✓
            </div>
          ) : PAYMENT_URL ? (
            <a
              href={PAYMENT_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-6 rounded-md py-3 text-center text-sm font-semibold"
            >
              Suscribirme por {PREMIUM_PRICE_FULL}
            </a>
          ) : (
            <button disabled className="mt-6 cursor-not-allowed rounded-md bg-ink/10 py-3 text-center text-sm font-semibold text-ink-faint">
              Pago próximamente
            </button>
          )}

          <p className="mt-3 text-xs text-ink-faint">
            {FREE_FOR_ALL
              ? 'No hace falta hacer nada ni cargar tarjeta: usá la app con todo incluido. Te vamos a avisar antes de que empiece a cobrarse.'
              : PAYMENT_URL
                ? 'Después de pagar, activamos tu cuenta a la brevedad (beta).'
                : 'Estamos habilitando el medio de pago. Mientras tanto, escribinos.'}
          </p>
          {user?.email && (
            <p className="mt-2 break-all text-[11px] text-ink-faint">Tu cuenta: {user.email}</p>
          )}
        </div>
      </div>

      <Link
        to="/invitar"
        className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-dashed border-teal-500/40 bg-teal-500/[0.05] px-5 py-4 transition hover:bg-teal-500/[0.09]"
      >
        <span className="text-sm text-ink-soft">
          🎁 <b className="text-ink">Invitá a 3 y ganá 3 meses</b> de premium, sin pagar nada.
        </span>
        <span className="text-sm font-medium text-teal-600">Ver mi link →</span>
      </Link>
    </div>
  )
}
