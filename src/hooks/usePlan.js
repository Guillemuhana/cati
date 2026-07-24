import { useAuth } from '../context/AuthContext'

/**
 * Estado del plan del usuario.
 * - Durante la prueba (72 h) todas las funciones premium están habilitadas.
 * - Después, solo si plan === 'premium'.
 */
export function usePlan() {
  const { profile } = useAuth()

  const now = Date.now()
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null
  const trialActive = trialEndsAt ? now < trialEndsAt : false
  const isPaid = profile?.plan === 'premium'
  const isPremium = isPaid || trialActive

  const msLeft = trialEndsAt ? Math.max(0, trialEndsAt - now) : 0
  const hoursLeft = Math.ceil(msLeft / 3_600_000)

  return {
    plan: profile?.plan || 'free',
    isPremium,
    isPaid,
    trialActive,
    trialEndsAt,
    hoursLeft,
    msLeft
  }
}
