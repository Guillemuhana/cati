import { useMemo, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../lib/utils'

// Selector para insertar un ítem desde el catálogo de productos.
export default function ProductPicker({ products, currency, onPick }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    if (!query) return products
    const q = query.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
  }, [products, query])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
          <path d="M3 12V4a1 1 0 0 1 1-1h8l8 8-9 9z" />
          <circle cx="7.5" cy="7.5" r="1.5" />
        </svg>
        {t('selector.delCatalogo')}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-line bg-surface shadow-soft">
          <div className="p-2">
            <input
              autoFocus
              type="text"
              placeholder={t('selector.buscarProducto')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-faint">{t('selector.sinProductos')}</p>
            ) : (
              filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    onPick(p)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-500/[0.06]"
                >
                  <span className="min-w-0 truncate text-ink">{p.name}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-soft">{formatMoney(p.unit_price, currency)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
