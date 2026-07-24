import { Link } from 'react-router-dom'
import { usePlan } from '../hooks/usePlan'
import { PREMIUM_FEATURES, PREMIUM_PRICE_FULL } from '../lib/config'

// Envuelve contenido premium: muestra los hijos si el usuario tiene acceso,
// o el paywall si la prueba terminó y no pagó.
export function PremiumGate({ children, title }) {
  const { isPremium } = usePlan()
  if (isPremium) return children
  return <Paywall title={title} />
}

export default function Paywall({ title = 'Función premium' }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl2 border border-line bg-surface p-8 text-center shadow-soft">
      <img src="/cati-icon.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700">
        🔒 {title}
      </span>
      <h2 className="mt-3 font-display text-2xl font-medium text-ink">Desbloqueá Cati completo</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Tu prueba gratuita terminó. Activá todas las funciones premium por <b>{PREMIUM_PRICE_FULL}</b>.
      </p>
      <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-ink-soft">
        {PREMIUM_FEATURES.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-0.5 text-teal-500">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link to="/premium" className="btn-primary mt-6 inline-block rounded-md px-6 py-3 text-sm font-semibold">
        Suscribirme por {PREMIUM_PRICE_FULL}
      </Link>
    </div>
  )
}
