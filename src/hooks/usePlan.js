import { useAuth } from '../context/AuthContext'
import { FREE_FOR_ALL } from '../lib/config'

/**
 * Estado del plan del usuario.
 * - Si FREE_FOR_ALL está activo, todo está desbloqueado para todos.
 * - Durante la prueba (1 mes) todas las funciones premium están habilitadas.
 * - Después, solo si plan === 'premium'.
 */
export function usePlan() {
  const { profile } = useAuth()

  const now = Date.now()
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null
  const trialActive = trialEndsAt ? now < trialEndsAt : false

  // Suscripción: pago si plan es premium y la suscripción no venció.
  // Si premium_until es null (activación manual sin fecha), se considera activa.
  const premiumUntil = profile?.premium_until ? new Date(profile.premium_until).getTime() : null
  const isPaid = profile?.plan === 'premium' && (premiumUntil == null || now < premiumUntil)

  const isPremium = FREE_FOR_ALL || isPaid || trialActive

  const msLeft = trialEndsAt ? Math.max(0, trialEndsAt - now) : 0
  const hoursLeft = Math.ceil(msLeft / 3_600_000)
  const daysLeft = Math.ceil(msLeft / 86_400_000)

  // Texto amigable: en días mientras falte más de un día, en horas al final.
  const trialLeftLabel = hoursLeft > 48 ? `${daysLeft} días` : `${hoursLeft} h`

  return {
    plan: profile?.plan || 'free',
    freeForAll: FREE_FOR_ALL,
    isPremium,
    isPaid,
    trialActive,
    trialEndsAt,
    premiumUntil,
    hoursLeft,
    daysLeft,
    trialLeftLabel,
    msLeft
  }
}
