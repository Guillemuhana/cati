// Configuración de monetización (beta) ─────────────────────────
// Todas las funciones premium son gratis durante la prueba de 1 mes
// y luego se desbloquean con la suscripción mensual.

// ⚠ FIN DE LA ETAPA GRATIS · 1 de NOVIEMBRE de 2026 (hora de Argentina)
//
// Hasta esa fecha la app no cobra ni bloquea nada: todas las funciones
// premium quedan abiertas para cualquiera. A partir de ese día vuelve a
// regir el plan pago.
//
// Esta fecha está ESCRITA DOS VECES a propósito: acá para el navegador y
// en public.free_until() (migración 11) para el servidor. Si algún día la
// movés, cambiá LAS DOS. El servidor es el que manda: si solo cambiaras
// esta constante, la app se vería cerrada pero la API seguiría regalando
// todo a quien sepa abrir la pestaña Network.
export const FREE_UNTIL = '2026-11-01T00:00:00-03:00'
export const FREE_UNTIL_LABEL = '1 de noviembre de 2026'

export const FREE_FOR_ALL = Date.now() < new Date(FREE_UNTIL).getTime()

// Días que faltan para el fin de la promo (0 si ya pasó).
export function freeDaysLeft() {
  const ms = new Date(FREE_UNTIL).getTime() - Date.now()
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0
}

// Prueba gratis para quien se registre DESPUÉS del 1/11/2026.
// Tiene que coincidir con el interval de handle_new_user (migración 11):
// el que manda es el de la base de datos.
export const TRIAL_DAYS = 30
export const TRIAL_HOURS = TRIAL_DAYS * 24
export const PROMO_LABEL = '30 días'
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
