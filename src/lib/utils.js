export const CURRENCIES = ['ARS', 'USD', 'EUR', 'UYU', 'CLP', 'MXN', 'BRL']

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

export function formatNumero(n) {
  return `CATI-${String(n).padStart(4, '0')}`
}

/**
 * Calcula subtotal, descuento, impuesto y total a partir de los ítems y las
 * reglas de descuento/impuesto del presupuesto.
 */
export function calculateTotals({ items = [], discountType = 'none', discountValue = 0, taxRate = 0 }) {
  const subtotal = items.reduce((acc, it) => {
    const lineBase = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
    const lineDiscount = lineBase * ((Number(it.discount) || 0) / 100)
    return acc + (lineBase - lineDiscount)
  }, 0)

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = subtotal * ((Number(discountValue) || 0) / 100)
  } else if (discountType === 'fixed') {
    discountAmount = Number(discountValue) || 0
  }
  discountAmount = Math.min(discountAmount, subtotal)

  const taxable = subtotal - discountAmount
  const taxAmount = taxable * ((Number(taxRate) || 0) / 100)
  const total = taxable + taxAmount

  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    taxAmount: round2(taxAmount),
    total: round2(total)
  }
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export const STATUS = {
  borrador: { label: 'Borrador', color: 'ink' },
  enviado: { label: 'Enviado', color: 'brass' },
  aprobado: { label: 'Aprobado', color: 'brand' },
  rechazado: { label: 'Rechazado', color: 'rust' },
  vencido: { label: 'Vencido', color: 'rust' }
}

export function classNames(...list) {
  return list.filter(Boolean).join(' ')
}
