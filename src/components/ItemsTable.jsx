import { formatMoney } from '../lib/utils'

let localId = 0
export function newItem() {
  localId += 1
  return { _key: `new-${localId}`, description: '', quantity: 1, unit_price: 0, discount: 0 }
}

// Importe de una línea: cantidad × precio − descuento %.
export function lineAmount(item) {
  const qty = Math.max(0, Number(item.quantity) || 0)
  const price = Math.max(0, Number(item.unit_price) || 0)
  const disc = Math.min(100, Math.max(0, Number(item.discount) || 0))
  const base = qty * price
  return base - base * (disc / 100)
}

const COLS = 'sm:grid-cols-[minmax(0,1fr)_84px_120px_84px_120px_40px]'

export default function ItemsTable({ items, onChange, currency }) {
  const update = (index, field, value) => {
    const next = items.slice()
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  const remove = (index) => {
    if (items.length <= 1) return // siempre queda al menos una fila
    onChange(items.filter((_, i) => i !== index))
  }

  const add = () => onChange([...items, newItem()])

  return (
    <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
      {/* Cabecera (solo desktop) */}
      <div
        className={`hidden gap-3 border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint sm:grid ${COLS}`}
      >
        <span>Descripción</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">Precio unit.</span>
        <span className="text-right">Desc. %</span>
        <span className="text-right">Importe</span>
        <span className="sr-only">Acciones</span>
      </div>

      <div className="divide-y divide-line">
        {items.map((item, index) => {
          const total = lineAmount(item)
          const last = items.length <= 1
          return (
            <div
              key={item._key || item.id}
              className={`grid gap-3 px-4 py-3 sm:items-center ${COLS}`}
            >
              {/* Descripción */}
              <div className="min-w-0">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-faint sm:hidden">
                  Descripción
                </span>
                <input
                  type="text"
                  placeholder="Ej: Diseño de landing page"
                  value={item.description}
                  onChange={(e) => update(index, 'description', e.target.value)}
                  className="w-full rounded-md border border-line bg-transparent px-2.5 py-2 text-sm text-ink transition placeholder:text-ink-faint focus:border-brand-500 focus:bg-white focus:outline-none sm:border-transparent sm:hover:border-line"
                />
              </div>

              {/* En móvil: cantidad / precio / descuento en grilla de 3 */}
              <div className="grid grid-cols-3 gap-3 sm:contents">
                <NumField
                  label="Cant."
                  value={item.quantity}
                  min={0}
                  step="0.5"
                  onChange={(v) => update(index, 'quantity', v)}
                />
                <NumField
                  label="Precio unit."
                  value={item.unit_price}
                  min={0}
                  step="0.01"
                  onChange={(v) => update(index, 'unit_price', v)}
                />
                <NumField
                  label="Desc. %"
                  value={item.discount}
                  min={0}
                  max={100}
                  step="1"
                  onChange={(v) => update(index, 'discount', v)}
                />
              </div>

              {/* Importe */}
              <div className="flex items-center justify-between sm:justify-end">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint sm:hidden">
                  Importe
                </span>
                <span className="font-mono text-sm font-semibold text-ink">{formatMoney(total, currency)}</span>
              </div>

              {/* Eliminar */}
              <div className="flex justify-end sm:block">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={last}
                  aria-label="Quitar ítem"
                  title={last ? 'Debe existir al menos un ítem' : 'Quitar ítem'}
                  className="rounded-md p-1.5 text-ink-faint transition hover:bg-rust-500/10 hover:text-rust-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-sm font-medium text-brand-600 transition hover:bg-brand-500/[0.05]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        Agregar ítem
      </button>
    </div>
  )
}

function NumField({ label, value, min, max, step, onChange }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-faint sm:hidden">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          // Normaliza: nunca por debajo del mínimo ni sobre el máximo.
          let n = Number(e.target.value)
          if (Number.isNaN(n)) n = min ?? 0
          if (min != null) n = Math.max(min, n)
          if (max != null) n = Math.min(max, n)
          onChange(String(n))
        }}
        className="w-full rounded-md border border-line bg-transparent px-2.5 py-2 text-right font-mono text-sm text-ink focus:border-brand-500 focus:bg-white focus:outline-none"
      />
    </div>
  )
}
