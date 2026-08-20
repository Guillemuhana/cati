import { Globe, Mail, Phone, MapPin } from 'lucide-react'
import { trazo } from './brandPaths'

// ------------------------------------------------------------
// Contacto y redes del negocio.
//
// El usuario escribe como le sale: «@minegocio», «minegocio.com»,
// «11 5555-4444» o la URL entera pegada del navegador. Acá se limpia
// y se arma la URL nosotros, con el dominio fijo escrito en el código.
//
// Eso último no es prolijidad, es seguridad: si guardáramos la URL tal
// cual la escribe y la pusiéramos en un <a href>, un «javascript:...»
// terminaría corriendo en el navegador del cliente que abre el enlace
// público. Como el link lo construimos con el usuario ya filtrado a
// letras, números, punto, guion y guion bajo, eso no puede pasar.
// Es el mismo criterio que isSafeImageUrl() en utils.js.
//
// Los íconos de interfaz son de lucide-react y los de marca son trazos
// de Simple Icons copiados al repo (ver brandPaths.js: importar el
// paquete entero triplicaba el bundle). Se guardan como `path` para
// dibujarlos igual en el HTML y en el PDF, que usan motores distintos.
// ------------------------------------------------------------

const limpiarUsuario = (v) =>
  (v || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?[^/]+\//i, '') // pegó la URL entera
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '') // saca la ruta y los ?utm_...
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 60)

const soloNumeros = (v) => (v || '').replace(/\D/g, '').slice(0, 15)

// wa.me quiere el número con código de país y sin signos. Si no lo puso,
// asumimos Argentina: es el 99% de los usuarios. Devuelve '' si lo que
// escribió no llega a ser un teléfono.
export function urlDeWhatsapp(valor) {
  const n = soloNumeros(valor)
  if (n.length < 8) return ''
  return `https://wa.me/${n.length <= 11 ? '54' + n.replace(/^0/, '') : n}`
}

// Convierte lo que escribió en una URL https válida, o '' si no se puede.
export function urlDeWeb(valor) {
  const v = (valor || '').trim()
  if (!v) return ''
  const conEsquema = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(conEsquema)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    if (!u.hostname.includes('.')) return ''
    return u.toString()
  } catch {
    return ''
  }
}

// Cada canal sabe limpiar lo que escribió el usuario, armar el link y
// mostrarlo corto. `icon` es un componente de lucide; `path`, el trazo
// de la marca (24×24) que sirve tanto en el navegador como en el PDF.
export const CANALES = [
  {
    key: 'website',
    label: 'Sitio web',
    placeholder: 'minegocio.com.ar',
    icon: Globe,
    color: '#2E5EA6',
    url: (v) => urlDeWeb(v),
    texto: (v) => (v || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    placeholder: '11 5555-4444',
    ayuda: 'Con característica, sin el 0 ni el 15. Ej: 11 5555-4444',
    path: trazo('whatsapp'),
    color: '#25D366',
    url: (v) => urlDeWhatsapp(v),
    texto: (v) => v
  },
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: '@minegocio',
    path: trazo('instagram'),
    color: '#E1306C',
    url: (v) => (limpiarUsuario(v) ? `https://instagram.com/${limpiarUsuario(v)}` : ''),
    texto: (v) => (limpiarUsuario(v) ? `@${limpiarUsuario(v)}` : '')
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'minegocio',
    path: trazo('facebook'),
    color: '#0866FF',
    url: (v) => (limpiarUsuario(v) ? `https://facebook.com/${limpiarUsuario(v)}` : ''),
    texto: (v) => limpiarUsuario(v)
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: '@minegocio',
    path: trazo('tiktok'),
    color: '#111111',
    url: (v) => (limpiarUsuario(v) ? `https://tiktok.com/@${limpiarUsuario(v)}` : ''),
    texto: (v) => (limpiarUsuario(v) ? `@${limpiarUsuario(v)}` : '')
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: '@micanal',
    path: trazo('youtube'),
    color: '#FF0000',
    url: (v) => (limpiarUsuario(v) ? `https://youtube.com/@${limpiarUsuario(v)}` : ''),
    texto: (v) => (limpiarUsuario(v) ? `@${limpiarUsuario(v)}` : '')
  },
  {
    key: 'x',
    label: 'X (Twitter)',
    placeholder: '@minegocio',
    path: trazo('x'),
    color: '#111111',
    url: (v) => (limpiarUsuario(v) ? `https://x.com/${limpiarUsuario(v)}` : ''),
    texto: (v) => (limpiarUsuario(v) ? `@${limpiarUsuario(v)}` : '')
  }
]

export const CANAL_KEYS = CANALES.map((c) => c.key)

// Los datos de contacto de toda la vida (ya viven en el perfil desde el
// primer día), para mostrarlos en la misma fila que las redes.
export const CONTACTO_BASE = [
  { key: 'phone', label: 'Teléfono', icon: Phone, url: (v) => `tel:${(v || '').replace(/[^\d+]/g, '')}`, texto: (v) => v },
  { key: 'email', label: 'Email', icon: Mail, url: (v) => `mailto:${(v || '').trim()}`, texto: (v) => v },
  { key: 'address', label: 'Dirección', icon: MapPin, url: () => '', texto: (v) => v }
]

// Los canales que este negocio realmente cargó, ya con el link armado.
// Si un valor no da una URL válida, el canal no aparece.
export function canalesDe(perfil, { incluirBase = true } = {}) {
  const lista = []
  if (incluirBase) {
    for (const c of CONTACTO_BASE) {
      const v = (perfil?.[c.key] || '').trim()
      if (v) lista.push({ ...c, valor: v, href: c.url(v), texto: c.texto(v) })
    }
  }
  for (const c of CANALES) {
    const v = (perfil?.[c.key] || '').trim()
    if (!v) continue
    const href = c.url(v)
    if (!href) continue
    lista.push({ ...c, valor: v, href, texto: c.texto(v) || v })
  }
  return lista
}
