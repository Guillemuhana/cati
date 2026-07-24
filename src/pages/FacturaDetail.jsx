import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import Card from '../components/Card'
import { PremiumGate } from '../components/Paywall'
import { InvoiceBadge } from './Facturas'
import { downloadInvoicePdf, downloadReceiptPdf } from '../lib/pdf'
import { lineAmount } from '../components/ItemsTable'
import { formatDate, formatMoney, formatNumero } from '../lib/utils'

export default function FacturaDetail() {
  return (
    <PremiumGate title="Facturas y comprobantes">
      <FacturaDetailInner />
    </PremiumGate>
  )
}

function FacturaDetailInner() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const [invoice, setInvoice] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [payOpen, setPayOpen] = useState(false)

  const load = async () => {
    const { data: inv } = await supabase.from('invoices').select('*, clients(*)').eq('id', id).single()
    const { data: recs } = await supabase.from('receipts').select('*').eq('invoice_id', id).order('created_at')
    setInvoice(inv)
    setReceipts(recs || [])
    setLoading(false)
  }

  useEffect(() => {
    if (user) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user])

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }
  if (!invoice) {
    return <p className="py-24 text-center text-sm text-ink-soft">Comprobante no encontrado.</p>
  }

  const client = invoice.clients || null
  const items = invoice.items || []
  const saldo = (Number(invoice.total) || 0) - (Number(invoice.paid_amount) || 0)

  const handleDownload = async () => {
    setBusy(true)
    try {
      await downloadInvoicePdf({ invoice, client, profile })
    } finally {
      setBusy(false)
    }
  }

  const registerPayment = async ({ amount, method, concept }) => {
    const value = Number(amount) || 0
    if (value <= 0) return
    // numeración de recibo
    const { count } = await supabase.from('receipts').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const numero = (count || 0) + 1
    const { data: rec, error } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        invoice_id: invoice.id,
        budget_id: invoice.budget_id,
        client_id: invoice.client_id,
        numero,
        amount: value,
        currency: invoice.currency,
        method: method || '',
        concept: concept || `Pago comprobante ${formatNumero(invoice.numero, invoice.issue_date, 'FAC')}`
      })
      .select()
      .single()
    if (error) return

    const newPaid = (Number(invoice.paid_amount) || 0) + value
    const newStatus = newPaid >= Number(invoice.total) ? 'pagada' : invoice.status === 'anulada' ? 'anulada' : 'emitida'
    await supabase.from('invoices').update({ paid_amount: newPaid, status: newStatus }).eq('id', invoice.id)

    setPayOpen(false)
    await load()
    // descargar el recibo recién creado
    downloadReceiptPdf({ receipt: rec, client, profile })
  }

  const anular = async () => {
    if (!window.confirm('¿Anular este comprobante?')) return
    await supabase.from('invoices').update({ status: 'anulada' }).eq('id', invoice.id)
    load()
  }

  return (
    <div>
      <Link to="/facturas" className="text-sm text-ink-soft hover:text-ink">
        ← Facturas
      </Link>

      <header className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-medium text-ink">{formatNumero(invoice.numero, invoice.issue_date, 'FAC')}</h1>
            <InvoiceBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {client?.name || 'Sin cliente'} · Emitido el {formatDate(invoice.issue_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownload} disabled={busy} className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink-faint disabled:opacity-60">
            Descargar PDF
          </button>
          {invoice.status !== 'anulada' && saldo > 0 && (
            <button onClick={() => setPayOpen(true)} className="btn-primary rounded-md px-3.5 py-2 text-sm font-semibold">
              Registrar pago
            </button>
          )}
        </div>
      </header>

      <p className="mt-3 rounded-md bg-brass-500/[0.08] px-3 py-2 text-xs text-ink-soft">
        Comprobante interno (no fiscal). No reemplaza la factura oficial de AFIP.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
            <div className="hidden grid-cols-[1fr_80px_120px_120px] gap-3 border-b border-line px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint sm:grid">
              <span>Descripción</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Precio unit.</span>
              <span className="text-right">Importe</span>
            </div>
            <div className="divide-y divide-line">
              {items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 sm:grid sm:grid-cols-[1fr_80px_120px_120px]">
                  <span className="flex-1 text-sm text-ink">
                    {it.description}
                    {Number(it.discount) > 0 && <span className="ml-1.5 text-xs text-brass-600">-{it.discount}%</span>}
                  </span>
                  <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">{it.quantity}</span>
                  <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">{formatMoney(it.unit_price, invoice.currency)}</span>
                  <span className="text-right font-mono text-sm font-medium text-ink">{formatMoney(lineAmount(it), invoice.currency)}</span>
                </div>
              ))}
            </div>
          </div>

          {receipts.length > 0 && (
            <Card title="Recibos">
              <ul className="divide-y divide-line">
                {receipts.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-ink">{formatNumero(r.numero, r.receipt_date, 'REC')}</p>
                      <p className="text-xs text-ink-soft">
                        {formatDate(r.receipt_date)}
                        {r.method ? ` · ${r.method}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-ink">{formatMoney(r.amount, r.currency)}</span>
                      <button onClick={() => downloadReceiptPdf({ receipt: r, client, profile })} className="text-xs font-medium text-brand-600 hover:underline">
                        PDF
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Resumen">
            <div className="space-y-2 font-mono text-sm">
              <Row label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} />
              {invoice.discount_amount > 0 && <Row label="Descuento" value={`-${formatMoney(invoice.discount_amount, invoice.currency)}`} />}
              {invoice.tax_amount > 0 && <Row label={`Impuesto (${invoice.tax_rate}%)`} value={formatMoney(invoice.tax_amount, invoice.currency)} />}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <span className="font-sans text-sm font-semibold text-ink">Total</span>
                <span className="text-base font-semibold text-brand-600">{formatMoney(invoice.total, invoice.currency)}</span>
              </div>
              <Row label="Pagado" value={formatMoney(invoice.paid_amount, invoice.currency)} />
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="font-sans text-sm font-semibold text-ink">Saldo</span>
                <span className={`font-semibold ${saldo > 0 ? 'text-ink' : 'text-teal-600'}`}>{formatMoney(saldo, invoice.currency)}</span>
              </div>
            </div>
          </Card>

          {invoice.status !== 'anulada' && (
            <button onClick={anular} className="text-sm font-medium text-rust-500 hover:text-rust-500/80">
              Anular comprobante
            </button>
          )}
        </div>
      </div>

      {payOpen && <PaymentModal saldo={saldo} currency={invoice.currency} onClose={() => setPayOpen(false)} onSave={registerPayment} />}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-ink-soft">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}

function PaymentModal({ saldo, currency, onClose, onSave }) {
  const [amount, setAmount] = useState(saldo > 0 ? saldo : 0)
  const [method, setMethod] = useState('')
  const [concept, setConcept] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ amount, method, concept })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-t-xl2 border border-line bg-surface p-6 shadow-soft sm:rounded-xl2">
        <h2 className="font-display text-xl font-medium text-ink">Registrar pago</h2>
        <p className="mt-1 text-xs text-ink-soft">Se genera un recibo en PDF automáticamente.</p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Monto ({currency})</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-right font-mono text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Forma de pago</span>
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Ej: Transferencia"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Concepto (opcional)</span>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Seña / Saldo final"
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 rounded-md py-2.5 text-sm font-semibold">
            {saving ? 'Guardando...' : 'Registrar y descargar recibo'}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-soft">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
