export const CURRENCIES = ['ARS', 'USD', 'EUR', 'UYU', 'CLP', 'MXN', 'BRL']

// Presets de IVA / impuesto para el selector rápido.
export const TAX_PRESETS = [
  { label: 'Sin IVA', value: 0 },
  { label: 'IVA 10,5%', value: 10.5 },
  { label: 'IVA 21%', value: 21 }
]

// Presets de vigencia (días) para la fecha de vencimiento.
export const VALIDITY_PRESETS = [7, 15, 30, 60]

export function formatMoney(value, currency = 'ARS') {
  const n = Number(value) || 0
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

export function formatDate(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value + 'T00:00:00') : value
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

/**
 * Número de presupuesto con formato PRES-2026-0001.
 * @param {number} n  correlativo del presupuesto
 * @param {string} [date]  fecha (issue_date) para derivar el año; opcional
 */
export function formatNumero(n, date, prefix = 'PRES') {
  const p = (prefix || 'PRES').trim() || 'PRES'
  const seq = String(n ?? 0).padStart(4, '0')
  if (date) {
    const year = new Date(date + 'T00:00:00').getFullYear()
    if (!Number.isNaN(year)) return `${p}-${year}-${seq}`
  }
  return `${p}-${seq}`
}

// Suma días a una fecha 'YYYY-MM-DD' y devuelve el mismo formato.
export function addDays(dateStr, days) {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  base.setDate(base.getDate() + Number(days || 0))
  return base.toISOString().slice(0, 10)
}

/**
 * Calcula subtotal, descuento, impuesto, total, anticipo y saldo.
 * Retrocompatible: si no se pasa `deposit`, deposit=0 y balance=total.
 */
export function calculateTotals({ items = [], discountType = 'none', discountValue = 0, taxRate = 0, deposit = 0 }) {
  const subtotal = items.reduce((acc, it) => {
    const qty = Math.max(0, Number(it.quantity) || 0)
    const price = Math.max(0, Number(it.unit_price) || 0)
    const disc = Math.min(100, Math.max(0, Number(it.discount) || 0))
    const lineBase = qty * price
    return acc + (lineBase - lineBase * (disc / 100))
  }, 0)

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = subtotal * (Math.min(100, Math.max(0, Number(discountValue) || 0)) / 100)
  } else if (discountType === 'fixed') {
    discountAmount = Math.max(0, Number(discountValue) || 0)
  }
  discountAmount = Math.min(discountAmount, subtotal)

  const taxable = subtotal - discountAmount
  const taxAmount = taxable * (Math.max(0, Number(taxRate) || 0) / 100)
  const total = taxable + taxAmount
  const dep = Math.min(Math.max(0, Number(deposit) || 0), total)
  const balance = total - dep

  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    total: round2(total),
    deposit: round2(dep),
    balance: round2(balance)
  }
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Valida un presupuesto y devuelve un objeto de errores { campo: mensaje }.
 * Vacío = válido. Mensajes en castellano.
 */
export function getBudgetErrors({ client_id, items = [], issue_date, due_date, discount_type, discount_value }) {
  const errors = {}

  if (!client_id) errors.client_id = 'Elegí un cliente para el presupuesto.'

  const contentItems = items.filter((it) => (it.description || '').trim() !== '' || Number(it.unit_price) > 0)
  if (contentItems.length === 0) {
    errors.items = 'Agregá al menos un ítem con descripción o precio.'
  } else {
    const bad = items.some((it) => {
      const hasAny = (it.description || '').trim() !== '' || Number(it.unit_price) > 0 || Number(it.quantity) > 0
      if (!hasAny) return false
      return Number(it.quantity) <= 0 || Number(it.unit_price) < 0 || Number(it.discount) < 0 || Number(it.discount) > 100
    })
    if (bad) errors.items = 'Revisá los ítems: cantidad mayor a 0, precio no negativo y descuento entre 0 y 100%.'
  }

  if (discount_type === 'percent' && Number(discount_value) > 100) {
    errors.discount_value = 'El descuento no puede superar el 100%.'
  }
  if (discount_type !== 'none' && Number(discount_value) < 0) {
    errors.discount_value = 'El descuento no puede ser negativo.'
  }

  if (issue_date && due_date && new Date(due_date) < new Date(issue_date)) {
    errors.due_date = 'El vencimiento no puede ser anterior a la emisión.'
  }

  return errors
}

export const STATUS = {
  borrador: { label: 'Borrador', color: 'ink' },
  enviado: { label: 'Enviado', color: 'brass' },
  visto: { label: 'Visto', color: 'brand' },
  aprobado: { label: 'Aprobado', color: 'teal' },
  aceptado: { label: 'Aceptado', color: 'teal' },
  rechazado: { label: 'Rechazado', color: 'rust' },
  vencido: { label: 'Vencido', color: 'rust' }
}

// Estados ofrecidos en los selectores (excluye el legacy 'aprobado').
export const STATUS_OPTIONS = ['borrador', 'enviado', 'visto', 'aceptado', 'rechazado', 'vencido']

export function classNames(...list) {
  return list.filter(Boolean).join(' ')
}

// ------------------------------------------------------------
// Color de marca: el usuario elige cualquier hex desde Perfil,
// incluso amarillos o pasteles. Estas funciones evitan que el
// documento público quede ilegible (texto blanco sobre amarillo).
// ------------------------------------------------------------

function toRgb(hex) {
  const h = String(hex || '').trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

// Luminancia relativa según WCAG 2.1
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// Texto legible sobre un fondo dado: blanco o tinta, el que más contraste dé.
export function contrastText(hex) {
  const rgb = toRgb(hex)
  if (!rgb) return '#FFFFFF'
  return contrast(rgb, [255, 255, 255]) >= contrast(rgb, [20, 24, 28]) ? '#FFFFFF' : '#14181C'
}

// Versión del color de marca oscurecida lo justo para usarla COMO TEXTO
// sobre papel blanco (títulos, el total). Los colores oscuros no cambian.
export function readableAccent(hex, minRatio = 4.5) {
  const rgb = toRgb(hex)
  if (!rgb) return '#2F6BFF'
  let out = rgb
  for (let i = 0; i < 24 && contrast(out, [255, 255, 255]) < minRatio; i++) {
    out = out.map((v) => v * 0.88)
  }
  return toHex(out)
}

// ¿El color se funde con el papel? No alcanza con mirar la luminancia: un
// amarillo es clarísimo pero se distingue perfecto del blanco. Pedimos las dos
// cosas — claro Y sin saturación — para no apagar marcas vivas.
export function isPaleColor(hex) {
  const rgb = toRgb(hex)
  if (!rgb) return false
  const chroma = Math.max(...rgb) - Math.min(...rgb)
  return contrast(rgb, [255, 255, 255]) < 1.6 && chroma < 60
}

// ¿Conviene dibujarle un borde al botón para que se recorte del papel?
export function needsOutline(hex) {
  const rgb = toRgb(hex)
  return rgb ? contrast(rgb, [255, 255, 255]) < 2 : false
}

// Empuja el fondo hacia oscuro o hacia claro hasta que el texto encima llegue
// al contraste mínimo AA. Los tonos medios son el caso feo: ni el blanco ni la
// tinta llegan a 4,5:1 y el botón queda legible «a medias».
export function ensureContrast(bg, fg, minRatio = 4.5) {
  const bgRgb = toRgb(bg)
  const fgRgb = toRgb(fg)
  if (!bgRgb || !fgRgb) return bg
  const toward = luminance(fgRgb) > 0.5 ? 0 : 255
  let out = bgRgb
  for (let i = 0; i < 40 && contrast(out, fgRgb) < minRatio; i++) {
    out = out.map((v) => v + (toward - v) * 0.06)
  }
  return toHex(out)
}

// El mismo color con transparencia, para sombras teñidas del color de marca.
export function withAlpha(hex, alpha) {
  const rgb = toRgb(hex)
  if (!rgb) return `rgba(20, 24, 28, ${alpha})`
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}
