// ------------------------------------------------------------
// Vista previa del enlace del presupuesto, con la marca del usuario.
//
// A esta función SOLO llegan los robots que arman la tarjetita del link
// (WhatsApp, Facebook, Telegram, Slack…). El filtro está en vercel.json,
// por User-Agent: una persona que abre el link entra a la app de
// siempre y no pasa por acá. Eso es a propósito — si esto se cae, se cae
// la miniatura, nunca el presupuesto.
//
// Esos robots no ejecutan JavaScript: leen el HTML crudo. Por eso las
// etiquetas og: se escriben acá en el servidor, con el nombre y el logo
// del negocio que mandó el presupuesto.
//
// Lo que se muestra es deliberadamente poco: nombre del negocio, logo y
// número. La previa la ve cualquiera en el grupo de WhatsApp donde se
// pegó el link; el cliente, los precios y los ítems quedan detrás.
// ------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// El logo tiene que ser una URL https de nuestro Storage. Es la misma
// regla que isSafeImageUrl() en el navegador: nada de lo que viene de la
// base entra crudo a un atributo.
const LOGO_OK = /^https:\/\/[a-z0-9-]+\.supabase\.co\//i

const escape = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 300)

export default async function handler(req, res) {
  const token = String((req.query && req.query.token) || '')
  const origen = `https://${req.headers['x-forwarded-host'] || req.headers.host}`

  let meta = null
  try {
    const url = process.env.VITE_SUPABASE_URL
    const key = process.env.VITE_SUPABASE_ANON_KEY
    if (UUID.test(token) && url && key) {
      const r = await fetch(`${url}/rest/v1/rpc/get_public_budget_meta`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_token: token })
      })
      if (r.ok) meta = await r.json()
    }
  } catch {
    // Si la base no contesta, sale la previa genérica. Nunca un error:
    // una miniatura fea es mejor que un link que parece roto.
    meta = null
  }

  const negocio = (meta && meta.business_name) || 'Numera'
  // Viene ya formateado de la base (PRES-2026-0014): la previa dice lo
  // mismo que el PDF y que la pantalla.
  const numero = meta && typeof meta.numero === 'string' ? meta.numero.slice(0, 40) : ''
  const titulo = meta ? [`Presupuesto${numero ? ' ' + numero : ''}`, negocio].join(' · ') : 'Presupuesto'
  const bajada = meta
    ? `Presupuesto de ${negocio}. Abrí el enlace para verlo en detalle, descargarlo en PDF y responder.`
    : 'Abrí el enlace para ver el presupuesto, descargarlo en PDF y responder.'
  const imagen = meta && LOGO_OK.test(meta.logo_url || '') ? meta.logo_url : `${origen}/logo-numera.png`
  const color = /^#[0-9a-f]{6}$/i.test((meta && meta.brand_color) || '') ? meta.brand_color : '#2F6BFF'

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(titulo)}</title>
<meta name="description" content="${escape(bajada)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="${escape(color)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escape(negocio)}">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${escape(titulo)}">
<meta property="og:description" content="${escape(bajada)}">
<meta property="og:image" content="${escape(imagen)}">
<meta property="og:url" content="${escape(origen)}/p/${escape(token)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escape(titulo)}">
<meta name="twitter:description" content="${escape(bajada)}">
<meta name="twitter:image" content="${escape(imagen)}">
</head>
<body>
<p>${escape(titulo)}</p>
<p><a href="/p/${escape(token)}">Ver el presupuesto</a></p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // La previa se cachea un rato: si el usuario cambia el logo, el robot
  // la vuelve a pedir más tarde. No es un dato que tenga que estar al
  // segundo, y así no le pegamos a la base en cada reenvío del link.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600')
  res.setHeader('X-Robots-Tag', 'noindex')
  res.status(200).send(html)
}
