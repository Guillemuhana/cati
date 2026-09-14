// ------------------------------------------------------------
// Webhook de Mercado Pago · activa el premium solo
//
// QUÉ HACE
//   Mercado Pago avisa acá cuando alguien se suscribe o cuando entra
//   un cobro recurrente. Esta función comprueba que el aviso sea de
//   verdad, le pregunta a Mercado Pago qué pasó (no le cree al aviso),
//   y recién ahí le da premium al usuario.
//
// POR QUÉ NO SE LE CREE AL AVISO
//   La notificación llega por internet abierto y trae un id, nada más.
//   Cualquiera que sepa la dirección puede mandar un POST diciendo
//   «se pagó». Por eso van dos cerrojos: la firma HMAC del header
//   x-signature, y después una consulta a la API de Mercado Pago con
//   nuestro token para ver el estado real de la suscripción.
//
// LOS SECRETOS
//   MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET se cargan como secrets de la
//   función, nunca en el repo:
//     supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
//     supabase secrets set MP_WEBHOOK_SECRET=...
//   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen dados.
//
// CÓMO SE CONFIGURA DEL LADO DE MERCADO PAGO
//   Panel → Tus integraciones → tu aplicación → Webhooks. Se pega la
//   URL de esta función y se tildan los eventos:
//     · subscription_preapproval          (alta, pausa, baja)
//     · subscription_authorized_payment   (cada cobro que entra)
//   Ahí mismo se genera la clave secreta que va en MP_WEBHOOK_SECRET.
// ------------------------------------------------------------

const MP_API = 'https://api.mercadopago.com'

// Días de colchón sobre la próxima fecha de cobro. Si Mercado Pago
// demora un débito, el usuario no se queda afuera el mismo día.
const DIAS_DE_GRACIA = 3

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 })
  }

  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!accessToken || !webhookSecret || !supabaseUrl || !serviceKey) {
    // 500 a propósito: Mercado Pago reintenta, así que un secret que
    // falta se arregla cargándolo y el aviso igual se procesa después.
    console.error('[mp-webhook] faltan secrets')
    return new Response('Sin configurar', { status: 500 })
  }

  const url = new URL(req.url)
  const cuerpo = await req.text()

  let aviso: Record<string, unknown> = {}
  try {
    aviso = cuerpo ? JSON.parse(cuerpo) : {}
  } catch {
    return new Response('Cuerpo inválido', { status: 400 })
  }

  // El id viene por query string y, según el evento, también en el
  // cuerpo. El de la URL es el que entra en la firma.
  const dataId = url.searchParams.get('data.id') || (aviso.data as { id?: string })?.id || ''
  const tipo = url.searchParams.get('type') || (aviso.type as string) || ''
  const accion = (aviso.action as string) || ''

  // ── Cerrojo 1: la firma ─────────────────────────────────────
  if (!(await firmaValida(req, dataId, webhookSecret))) {
    console.error('[mp-webhook] firma inválida', { tipo, dataId })
    // 401 y no 500: que NO reintente. Si la firma no cierra, no va a
    // cerrar en el reintento tampoco.
    return new Response('Firma inválida', { status: 401 })
  }

  if (!dataId || !tipo) {
    return new Response('OK (aviso sin datos)', { status: 200 })
  }

  try {
    // ── Cerrojo 2: preguntarle a Mercado Pago ─────────────────
    const sub = await traerSuscripcion(tipo, dataId, accessToken)

    const anotar = (datos: Record<string, unknown>) =>
      fetch(`${supabaseUrl}/rest/v1/rpc/mp_aplicar_suscripcion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`
        },
        body: JSON.stringify(datos)
      })

    // Un evento que no sabemos leer NO se tira a la basura.
    //
    // Mercado Pago agrupa los avisos en el panel, así que no hay forma
    // de saber de antemano con qué nombre exacto va a llegar el cobro
    // del mes. Si llega con uno que esta función no maneja y lo
    // descartáramos en silencio, el premium dejaría de renovarse y
    // nadie se enteraría hasta que un cliente reclame.
    //
    // Anotado, en cambio, aparece en mp_eventos como no resuelto y se
    // ve qué mandaron de verdad.
    if (!sub) {
      await anotar({
        p_tipo: tipo,
        p_accion: accion,
        p_recurso_id: dataId,
        p_preapproval_id: null,
        p_plan_id: null,
        p_estado: 'sin_procesar',
        p_payer_email: null,
        p_external_ref: null,
        p_hasta: null,
        p_payload: aviso
      })
      console.log('[mp-webhook] evento sin procesar', tipo, dataId)
      // 200 igual: que no reintente para siempre por algo que no es un
      // error de Mercado Pago ni nuestro.
      return new Response('OK (evento anotado sin procesar)', { status: 200 })
    }

    const hasta = calcularHasta(sub)

    const r = await anotar({
      p_tipo: tipo,
      p_accion: accion,
      p_recurso_id: dataId,
      p_preapproval_id: sub.id ?? null,
      p_plan_id: sub.preapproval_plan_id ?? null,
      p_estado: sub.status ?? null,
      p_payer_email: sub.payer_email ?? null,
      p_external_ref: sub.external_reference ?? null,
      p_hasta: hasta,
      p_payload: sub
    })

    if (!r.ok) {
      const detalle = await r.text()
      console.error('[mp-webhook] la base rechazó el evento', r.status, detalle)
      return new Response('Error al aplicar', { status: 500 })
    }

    const resultado = await r.json()
    console.log('[mp-webhook]', tipo, dataId, JSON.stringify(resultado))
    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[mp-webhook] error', err)
    // 500 para que Mercado Pago reintente: puede haber sido un corte
    // de red hacia su propia API.
    return new Response('Error', { status: 500 })
  }
})

// ------------------------------------------------------------
// La firma que manda Mercado Pago.
//
//   x-signature: ts=1704908010,v1=618c85...
//
// Se rearma el mismo texto que ellos firmaron y se compara el HMAC.
// El id va en minúsculas y el request-id se omite entero si no vino.
// ------------------------------------------------------------
async function firmaValida(req: Request, dataId: string, secret: string): Promise<boolean> {
  const firma = req.headers.get('x-signature') || ''
  const requestId = req.headers.get('x-request-id') || ''

  let ts = ''
  let v1 = ''
  for (const parte of firma.split(',')) {
    const [k, v] = parte.split('=').map((x) => x?.trim())
    if (k === 'ts') ts = v
    if (k === 'v1') v1 = v
  }
  if (!ts || !v1) return false

  let manifest = `id:${dataId.toLowerCase()};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`

  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const firmado = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(manifest))
  const esperado = [...new Uint8Array(firmado)].map((b) => b.toString(16).padStart(2, '0')).join('')

  return comparacionPareja(esperado, v1)
}

/** Compara sin delatar en cuántos caracteres se equivocó el que prueba. */
function comparacionPareja(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

type Suscripcion = {
  id?: string
  status?: string
  payer_email?: string
  external_reference?: string
  preapproval_plan_id?: string
  next_payment_date?: string
  auto_recurring?: { frequency?: number; frequency_type?: string }
}

// ------------------------------------------------------------
// Qué pasó de verdad, según Mercado Pago.
//
// Los dos eventos terminan en el mismo lado: la suscripción. El del
// cobro recurrente trae el id del pago, así que primero hay que
// preguntar a qué suscripción pertenece.
// ------------------------------------------------------------
async function traerSuscripcion(tipo: string, id: string, token: string): Promise<Suscripcion | null> {
  const pedir = async (ruta: string) => {
    const r = await fetch(`${MP_API}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) {
      console.error('[mp-webhook] Mercado Pago respondió', r.status, 'a', ruta)
      return null
    }
    return await r.json()
  }

  if (tipo === 'subscription_preapproval') {
    return await pedir(`/preapproval/${id}`)
  }

  if (tipo === 'subscription_authorized_payment') {
    const pago = await pedir(`/authorized_payments/${id}`)
    const preapprovalId = pago?.preapproval_id
    if (!preapprovalId) return null
    const sub = await pedir(`/preapproval/${preapprovalId}`)
    // El estado que importa es el del cobro: puede haber rebotado la
    // tarjeta con la suscripción todavía en «authorized».
    if (sub && pago?.status) sub.status = pago.status
    return sub
  }

  // subscription_preapproval_plan y los demás no activan a nadie.
  return null
}

// ------------------------------------------------------------
// Hasta cuándo queda pago.
//
// Lo natural es la próxima fecha de cobro más el colchón. Si Mercado
// Pago no la manda, se estima con la frecuencia del plan: un mes para
// el mensual, doce para el anual.
// ------------------------------------------------------------
function calcularHasta(sub: Suscripcion): string {
  const base = sub.next_payment_date ? new Date(sub.next_payment_date) : null

  if (base && !Number.isNaN(base.getTime())) {
    base.setDate(base.getDate() + DIAS_DE_GRACIA)
    return base.toISOString()
  }

  const meses =
    sub.auto_recurring?.frequency_type === 'months' ? (sub.auto_recurring?.frequency ?? 1) : 1
  const estimada = new Date()
  estimada.setMonth(estimada.getMonth() + meses)
  estimada.setDate(estimada.getDate() + DIAS_DE_GRACIA)
  return estimada.toISOString()
}
