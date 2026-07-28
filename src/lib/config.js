// Configuración de monetización (beta) ─────────────────────────
// Todas las funciones premium son gratis durante la prueba de 1 mes
// y luego se desbloquean con la suscripción mensual.

// ⚠ INTERRUPTOR GENERAL · TODO GRATIS
// Mientras esté en true, la app no cobra ni bloquea nada: todas las
// funciones premium quedan abiertas para cualquier usuario y no se
// muestran ni el paywall ni el cartel de prueba.
//
// Para volver a cobrar:
//   1) poner esto en false
//   2) restaurar el bloqueo del servidor ejecutando en Supabase la parte
//      "VOLVER A COBRAR" de supabase/migration_09_todo_gratis.sql
export const FREE_FOR_ALL = true

// Promo de lanzamiento: 2 meses gratis con todo desbloqueado.
export const TRIAL_DAYS = 60
export const TRIAL_HOURS = TRIAL_DAYS * 24
export const PROMO_LABEL = '2 meses'
export const TRIAL_LABEL = `${PROMO_LABEL} gratis`
export const PREMIUM_PRICE = 'USD 2'
export const PREMIUM_PERIOD = 'por mes' // suscripción mensual
export const PREMIUM_PRICE_FULL = `${PREMIUM_PRICE}/mes`

// Link de SUSCRIPCIÓN mensual de Stripe (Payment Link con precio recurrente).
// Se crea en: Stripe Dashboard → Payment Links → New → precio "recurrente / mensual" USD 2.
// Queda como 'https://buy.stripe.com/xxxxxxxx'. Si está vacío, el botón muestra "Próximamente".
export const PAYMENT_URL = ''

// Lista de beneficios premium (se muestran en el paywall / página /premium).
export const PREMIUM_FEATURES = [
  'Catálogo de productos y servicios reutilizables',
  'Plantillas de presupuesto',
  'Enlace público + QR para que el cliente vea y acepte',
  'Seguimiento: visto / aceptado / rechazado',
  'PDF con tu marca (color, prefijo, sin “Generado con Numera”)',
  'Reportes y exportación a Excel/CSV'
]
