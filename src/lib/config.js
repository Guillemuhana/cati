// Configuración de monetización (beta) ─────────────────────────
// Todas las funciones premium son gratis durante la prueba y luego
// se desbloquean con un pago único.

export const TRIAL_HOURS = 72
export const PREMIUM_PRICE = 'USD 2'

// Pegá acá tu link de pago (Mercado Pago / Lemon Squeezy / Stripe...).
// Ejemplo Mercado Pago: 'https://mpago.la/xxxxx'
// Si queda vacío, el botón muestra "Próximamente".
export const PAYMENT_URL = ''

// Lista de beneficios premium (se muestran en el paywall / página /premium).
export const PREMIUM_FEATURES = [
  'Catálogo de productos y servicios reutilizables',
  'Plantillas de presupuesto',
  'Enlace público + QR para que el cliente vea y acepte',
  'Seguimiento: visto / aceptado / rechazado',
  'PDF con tu marca (color, prefijo, sin “Generado con Cati”)',
  'Reportes y exportación a Excel/CSV'
]
