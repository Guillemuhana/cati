import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getStoredReferral, clearStoredReferral } from '../lib/referral'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setIsAdmin(false)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data || null)

    // Quién es admin lo decide la base de datos (migración 12). Esto es
    // solo para mostrar u ocultar el ítem del menú: aunque alguien fuerce
    // este valor a true desde la consola, los RPC del panel le van a
    // contestar 'no autorizado'.
    const { data: admin } = await supabase.rpc('is_admin')
    setIsAdmin(admin === true)
  }, [])

  // Si la visita vino por un link de invitación, el código viaja en los
  // metadatos del alta por email. Con Google eso no se puede, así que se
  // acredita acá, apenas vuelve. La base pone los candados: solo para uno
  // mismo, solo si no tiene ya quién lo invitó y solo en la primera hora
  // de vida de la cuenta.
  const acreditarInvitacion = useCallback(async () => {
    const code = getStoredReferral()
    if (!code) return
    try {
      await supabase.rpc('claim_referral', { p_code: code })
      clearStoredReferral()
    } catch {
      // Sin la migración 26 la función no existe: no pasa nada, el alta
      // por email sigue acreditando como siempre.
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      loadProfile(session?.user?.id).finally(() => setLoading(false))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((evento, session) => {
      setSession(session)
      loadProfile(session?.user?.id)
      if (evento === 'SIGNED_IN' && session?.user) acreditarInvitacion()
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfile, acreditarInvitacion])

  const signUp = async ({ email, password, businessName, rubro, referralCode }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
          // El rubro lo copia al perfil el mismo trigger (migración 19).
          rubro: rubro || '',
          // Código de quien invitó. Lo valida y lo acredita el trigger
          // (migración 10): mandar un código inventado no hace nada.
          referral_code: referralCode || ''
        }
      }
    })
    if (error) throw error

    // El perfil y la prueba de 1 mes los crea un trigger en la base de datos
    // (handle_new_user, migración 07). No se crean desde el navegador: si no,
    // cualquiera podría auto-asignarse plan premium o una prueba infinita.
    return data
  }

  // Entrar con Google. El alta la hace Google, así que no pasa por
  // nuestro formulario: el perfil lo crea igual el trigger de la base
  // (migración 26), pero sin nombre del negocio ni rubro. Esos dos los
  // pide después la pantalla de bienvenida del panel.
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/panel`,
        // Que muestre el selector de cuentas: mucha gente tiene la
        // personal y la del negocio en el mismo teléfono.
        queryParams: { prompt: 'select_account' }
      }
    })
    if (error) throw error
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = () => loadProfile(session?.user?.id)

  // Campos del negocio que el usuario puede editar. Es la misma lista que los
  // GRANT a nivel columna de la migración 07: si acá se colara un campo de
  // facturación (plan, premium_until…), Postgres rechazaría el UPDATE entero.
  const EDITABLE_FIELDS = [
    'business_name',
    'email',
    'phone',
    'tax_id',
    'address',
    'logo_url',
    'rubro',
    'website',
    'whatsapp',
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'x',
    'currency',
    'default_terms',
    'default_payment_terms',
    'default_payment_methods',
    'legal_terms',
    'bank_alias',
    'brand_color',
    'number_prefix',
    'hide_branding'
  ]

  const updateProfile = async (updates) => {
    if (!session?.user?.id) return
    const safe = Object.fromEntries(
      Object.entries(updates).filter(([k]) => EDITABLE_FIELDS.includes(k))
    )
    const { data, error } = await supabase
      .from('profiles')
      .update(safe)
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const value = {
    session,
    user: session?.user || null,
    profile,
    loading,
    isAdmin,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshProfile,
    updateProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
