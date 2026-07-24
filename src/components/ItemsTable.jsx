import { formatMoney } from '../lib/utils'

let localId = 0
export function newItem() {
  localId += 1
  return { _key: `new-${Date.now()}-${localId}`, description: '', quantity: 1, unit_price: 0, discount: 0 }
}

export default function ItemsTable({ items, onChange, currency }) {
  const update = (index, field, value) => {
    const next = items.slice()
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  const remove = (index) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const add = () => onChange([...items, newItem()])

  return (
    <div className="rounded-xl2 border border-line bg-surface">
      {/* Cabecera - solo desktop */}
      <div className="hidden grid-cols-[1fr_90px_130px_90px_130px_36px] gap-3 border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint sm:grid">
        <span>Descripción</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">Precio unit.</span>
        <span className="text-right">Desc. %</span>
        <span className="text-right">Importe</span>
        <span />
      </div>

      <div className="divide-y divide-line">
        {items.map((item, index) => {
          const lineBase = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
          const lineTotal = lineBase - lineBase * ((Number(item.discount) || 0) / 100)
          return (
            <div
              key={item._key || item.id}
              className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_90px_130px_90px_130px_36px] sm:items-center"
            >
              <input
                type="text"
                placeholder="Ej: Diseño de landing page"
                value={item.description}
                onChange={(e) => update(index, 'description', e.target.value)}
                className="col-span-2 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-ink transition placeholder:text-ink-faint hover:border-line focus:border-brand-500 focus:bg-white focus:outline-none sm:col-span-1"
              />
              <Field label="Cant.">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={item.quantity}
                  onChange={(e) => update(index, 'quantity', e.target.value)}
                  className="w-full rounded-md border border-line bg-transparent px-2 py-1.5 text-right font-mono text-sm focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="Precio unit.">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => update(index, 'unit_price', e.target.value)}
                  className="w-full rounded-md border border-line bg-transparent px-2 py-1.5 text-right font-mono text-sm focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="Desc. %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={item.discount}
                  onChange={(e) => update(index, 'discount', e.target.value)}
                  className="w-full rounded-md border border-line bg-transparent px-2 py-1.5 text-right font-mono text-sm focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <div className="flex items-center justify-between sm:justify-end">
                <span className="text-[11px] uppercase tracking-wide text-ink-faint sm:hidden">Importe</span>
                <span className="font-mono text-sm font-medium text-ink">{formatMoney(lineTotal, currency)}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Quitar ítem"
                className="justify-self-end text-ink-faint transition hover:text-rust-500"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center gap-2 rounded-b-xl2 px-4 py-3 text-sm font-medium text-brand-600 transition hover:bg-brand-500/[0.05]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Agregar ítem
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-faint sm:hidden">{label}</span>
      {children}
    </div>
  )
}
