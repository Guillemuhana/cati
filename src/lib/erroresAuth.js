import { useTranslation } from 'react-i18next'

/**
 * Los errores de Supabase vienen siempre en inglés y con la redacción de
 * un servidor («Invalid login credentials»). Acá se los reconoce por su
 * texto y se devuelve la clave del catálogo, para poder mostrarlos en el
 * idioma de la pantalla.
 *
 * Se compara por el texto y no por un código porque GoTrue no manda uno
 * estable para todos estos casos. Si mañana cambia la redacción, lo peor
 * que pasa es que se vea el mensaje original en inglés: feo, pero nunca
 * una pantalla muda.
 */
export function claveDeErrorAuth(message = '') {
  const m = `${message}`.toLowerCase()
  if (m.includes('invalid login credentials')) return 'auth.errores.credenciales'
  if (m.includes('user already registered')) return 'auth.errores.yaRegistrado'
  if (m.includes('password should be at least')) return 'auth.errores.passwordCorta'
  return ''
}

/** Devuelve una función que convierte el error de Supabase en texto legible. */
export function useMensajeErrorAuth() {
  const { t } = useTranslation()
  return (message) => {
    const clave = claveDeErrorAuth(message)
    if (clave) return t(clave)
    return message || t('auth.errores.generico')
  }
}
