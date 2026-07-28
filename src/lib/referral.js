// Código de invitación: viaja en la URL como ?ref=ABC123.
//
// Se guarda en localStorage apenas entra la visita, porque entre que
// alguien abre el link y termina de crear la cuenta suele pasear por la
// portada, y ahí se perdería el parámetro de la URL.

const KEY = 'numera.ref'
const MAX_INVITADOS = 3

/** Lee ?ref= de la URL actual y lo guarda. Se llama una vez al arrancar. */
export function captureReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code) window.localStorage.setItem(KEY, normalizeCode(code))
  } catch {
    // Modo incógnito con storage bloqueado: seguimos sin invitación.
  }
}

/** Código guardado, o '' si esta visita no vino por un link de invitación. */
export function getStoredReferral() {
  try {
    return window.localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

/** Se limpia después de un alta exitosa para no reusarlo en otra cuenta. */
export function clearStoredReferral() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignorar */
  }
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().slice(0, 12)
}

/** Link para compartir: https://tu-dominio/registro?ref=CODIGO */
export function buildReferralUrl(code) {
  if (!code) return ''
  return `${window.location.origin}/registro?ref=${encodeURIComponent(code)}`
}

export { MAX_INVITADOS }
