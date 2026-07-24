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
