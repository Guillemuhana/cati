import { usePlan } from '../hooks/usePlan'
import { PAYMENT_URL, PREMIUM_PRICE, PREMIUM_FEATURES } from '../lib/config'
import { useAuth } from '../context/AuthContext'

export default function Premium() {
  const { user } = useAuth()
  const { isPaid, trialActive, hoursLeft } = usePlan()

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 text-center">
        <img src="/cati-icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h1 className="font-display text-3xl font-medium text-ink">Cati Premium</h1>
        <p className="mt-1 text-sm text-ink-soft">Todo lo que necesitás para cerrar más presupuestos.</p>
      </header>

      {/* Estado del plan */}
      <div className="mb-6 rounded-xl2 border border-line bg-surface p-5 text-center shadow-soft">
        {isPaid ? (
          <p className="text-sm font-medium text-teal-600">✓ Ya tenés Cati Premium activo. ¡Gracias!</p>
        ) : trialActive ? (
          <p className="text-sm text-ink-soft">
            Estás en tu <b>prueba gratuita</b>. Te quedan{' '}
            <span className="font-semibold text-brand-700">{hoursLeft} h</span> con todo desbloqueado.
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Tu prueba gratuita terminó. Desbloqueá todo con un pago único.</p>
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
        <div className="flex flex-col rounded-xl2 border-2 border-brand-500/30 bg-gradient-to-br from-brand-500/[0.06] to-teal-500/[0.06] p-6 shadow-soft">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Pago único</p>
          <p className="mt-1 font-display text-4xl font-semibold text-brand-700">{PREMIUM_PRICE}</p>
          <p className="mt-1 text-xs text-ink-soft">Sin suscripción. Desbloqueás todo.</p>

          {isPaid ? (
            <div className="mt-6 rounded-md bg-teal-500/10 px-4 py-3 text-center text-sm font-medium text-teal-600">
              Premium activo ✓
            </div>
          ) : PAYMENT_URL ? (
            <a
              href={PAYMENT_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-6 rounded-md py-3 text-center text-sm font-semibold"
            >
              Pagar {PREMIUM_PRICE}
            </a>
          ) : (
            <button disabled className="mt-6 cursor-not-allowed rounded-md bg-ink/10 py-3 text-center text-sm font-semibold text-ink-faint">
              Pago próximamente
            </button>
          )}

          <p className="mt-3 text-xs text-ink-faint">
            {PAYMENT_URL
              ? 'Después de pagar, activamos tu cuenta a la brevedad (beta).'
              : 'Estamos habilitando el medio de pago. Mientras tanto, escribinos.'}
          </p>
          {user?.email && <p className="mt-2 text-[11px] text-ink-faint">Tu cuenta: {user.email}</p>}
        </div>
      </div>
    </div>
  )
}
