import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { PremiumGate } from '../components/Paywall'
import { formatDate, formatMoney, formatNumero } from '../lib/utils'

export const INVOICE_STATUS = {
  emitida: { label: 'Emitida', cls: 'text-brass-600 border-brass-500/40 bg-brass-500/[0.08]' },
  pagada: { label: 'Pagada', cls: 'text-teal-600 border-teal-500/50 bg-teal-500/[0.10]' },
  anulada: { label: 'Anulada', cls: 'text-rust-500 border-rust-500/40 bg-rust-500/[0.08]' }
}

export function InvoiceBadge({ status }) {
  const s = INVOICE_STATUS[status] || INVOICE_STATUS.emitida
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  )
}

export default function Facturas() {
  return (
    <PremiumGate title="Facturas y comprobantes">
      <FacturasInner />
    </PremiumGate>
  )
}

function FacturasInner() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('invoices')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInvoices(data || [])
        setLoading(false)
      })
  }, [user])

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium text-ink">Facturas y comprobantes</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Comprobantes internos (no fiscales). Se generan desde un presupuesto aceptado.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {loading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-ink-soft">Todavía no generaste comprobantes.</p>
            <p className="mt-1 text-xs text-ink-faint">Abrí un presupuesto y tocá «Convertir en factura».</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link to={`/facturas/${inv.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-brand-500/[0.04]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {inv.clients?.name || 'Sin cliente'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {formatNumero(inv.numero, inv.issue_date, 'FAC')} · {formatDate(inv.issue_date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm text-ink">{formatMoney(inv.total, inv.currency)}</span>
                    <InvoiceBadge status={inv.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
