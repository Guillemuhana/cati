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
// ⚠ Si cobrás con Mercado Pago Argentina, el plan se crea en PESOS:
// poné acá el mismo número que pusiste en el plan (ej: '$ 2.000') o el
// usuario ve un precio y le aparece otro en el checkout.
export const PREMIUM_PRICE = 'USD 2'
export const PREMIUM_PERIOD = 'por mes' // suscripción mensual
export const PREMIUM_PRICE_FULL = `${PREMIUM_PRICE}/mes`

// ------------------------------------------------------------
// COBRO · Link de SUSCRIPCIÓN mensual (Mercado Pago)
//
// CÓMO SE SACA
//   Panel de Mercado Pago → «Suscripciones» (según la versión del panel
//   puede decir «Cobros recurrentes») → crear un plan mensual con el
//   precio de abajo → copiar el link de suscripción.
//   Queda algo así:
//     https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=XXXXXXXX
//   Ese link es PÚBLICO: puede vivir acá sin problema.
//
// ⚠ LO QUE NO VA ACÁ NI EN NINGÚN ARCHIVO DEL REPO
//   El ACCESS TOKEN (APP_USR-...) y el CLIENT SECRET de Mercado Pago son
//   secretos. Todo lo que está en src/ se compila y viaja al navegador:
//   cualquiera puede leerlo con F12. Con ese token se cobra y se
//   reembolsa en tu nombre. Si alguna vez lo pegaste en el código,
//   revocalo y generá uno nuevo antes de publicar.
//   (Además el CSP de vercel.json solo deja hablar con Supabase, así que
//   una llamada a la API de MP desde el navegador ni siquiera saldría.)
//
// MIENTRAS TANTO: LA ALTA ES A MANO Y ESTÁ LISTA
//   Con este link el cliente se suscribe, pero nadie le marca «premium»
//   en la base. Eso lo hacés vos desde /admin → usuario → «Dar premium»
//   (función admin_grant_premium, migración 12). Con pocos suscriptores
//   alcanza y sobra, y es a prueba de errores de webhook.
//   Para que se active solo hace falta un webhook en el servidor: se
//   puede hacer con una Edge Function de Supabase, guardando el token
//   como secret de la función. Es el siguiente paso, no este.
//
// Si queda vacío, el botón muestra «Próximamente».
// ------------------------------------------------------------
export const PAYMENT_URL = ''

// Lista de beneficios premium (se muestran en el paywall / página /premium).
// Claves del catálogo de idiomas, no texto: la lista se muestra en el
// paywall y en la página de planes, las dos traducidas.
export const PREMIUM_FEATURES = [
  'premium.features.catalogo',
  'premium.features.plantillas',
  'premium.features.enlace',
  'premium.features.seguimiento',
  'premium.features.marca',
  'premium.features.reportes'
]
