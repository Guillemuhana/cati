// Configuración de monetización (beta) ─────────────────────────
// Todas las funciones premium son gratis durante la prueba y luego
// se desbloquean con un pago único.

export const TRIAL_HOURS = 72
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
