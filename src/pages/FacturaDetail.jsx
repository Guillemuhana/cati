import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import Card from '../components/Card'
import { PremiumGate } from '../components/Paywall'
import { InvoiceBadge } from './Facturas'
import { downloadInvoicePdf, downloadReceiptPdf } from '../lib/pdf'
import ItemsTable, { lineAmount } from '../components/ItemsTable'
import {
  calculateTotals,
  formatDate,
  formatMoney,
  formatNumero,
  hayDescripcionLarga,
  partirDescripcion
} from '../lib/utils'

export default function FacturaDetail() {
  const { t } = useTranslation()
  return (
    <PremiumGate title={t('facturas.gate')}>
      <FacturaDetailInner />
    </PremiumGate>
  )
}

function FacturaDetailInner() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { user, profile } = useAuth()
  const [invoice, setInvoice] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pdfError, setPdfError] = useState('')

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
    return <p className="py-24 text-center text-sm text-ink-soft">{t('factura.noEncontrado')}</p>
  }

  const client = invoice.clients || null
  const items = invoice.items || []
  const saldo = (Number(invoice.total) || 0) - (Number(invoice.paid_amount) || 0)
  const anulada = invoice.status === 'anulada'
  // Con una memoria descriptiva larga la tabla de columnas no sirve.
  const textoLargo = hayDescripcionLarga(items)

  const handleDownload = async () => {
    setBusy(true)
    setPdfError('')
    try {
      await downloadInvoicePdf({ invoice, client, profile })
    } catch (err) {
      setPdfError(err?.message || t('factura.errorPdf'))
    } finally {
      setBusy(false)
    }
  }

  const handleReceiptDownload = async (receipt) => {
    setPdfError('')
    try {
      await downloadReceiptPdf({ receipt, client, profile })
    } catch (err) {
      setPdfError(err?.message || t('factura.errorPdfRecibo'))
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
        concept:
          concept ||
          t('factura.conceptoPago', { numero: formatNumero(invoice.numero, invoice.issue_date, 'FAC') })
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
    await handleReceiptDownload(rec)
  }

  const guardarEdicion = async (cambios) => {
    const { error } = await supabase.from('invoices').update(cambios).eq('id', invoice.id)
    if (error) return error
    setEditOpen(false)
    await load()
    return null
  }

  const anular = async () => {
    if (!window.confirm(t('factura.confirmarAnular'))) return
    await supabase.from('invoices').update({ status: 'anulada' }).eq('id', invoice.id)
    load()
  }

  return (
    <div>
      <Link to="/facturas" className="text-sm text-ink-soft hover:text-ink">
        {t('factura.volver')}
      </Link>

      <header className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-medium text-ink">
              {formatNumero(invoice.numero, invoice.issue_date, 'FAC')}
            </h1>
            <InvoiceBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {client?.name || t('panel.sinCliente')} ·{' '}
            {t('factura.emitidoEl', { fecha: formatDate(invoice.issue_date) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Un comprobante anulado es un documento cerrado: no se edita. */}
          {!anulada && (
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink-faint"
            >
              {t('comun.editar')}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={busy}
            className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
          >
            {busy ? t('factura.generando') : t('factura.descargarPdf')}
          </button>
          {!anulada && saldo > 0 && (
            <button onClick={() => setPayOpen(true)} className="btn-primary rounded-md px-3.5 py-2 text-sm font-semibold">
              {t('factura.registrarPago')}
            </button>
          )}
        </div>
      </header>

      {pdfError && (
        <p className="mt-3 rounded-md border border-rust-500/40 bg-rust-500/[0.08] px-3 py-2 text-xs text-rust-500">
          {pdfError}
        </p>
      )}

      <p className="mt-3 rounded-md bg-brass-500/[0.08] px-3 py-2 text-xs text-ink-soft">
        {t('factura.avisoNoFiscal')}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
            {!textoLargo && (
              <div className="hidden grid-cols-[1fr_80px_120px_120px] gap-3 border-b border-line px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint sm:grid">
                <span>{t('items.descripcion')}</span>
                <span className="text-right">{t('items.cantidad')}</span>
                <span className="text-right">{t('items.precioUnit')}</span>
                <span className="text-right">{t('items.importe')}</span>
              </div>
            )}
            <div className="divide-y divide-line">
              {items.map((it, i) => {
                if (textoLargo) {
                  const { titulo, cuerpo } = partirDescripcion(it.description)
                  return (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line pb-2">
                        <span className="flex flex-wrap items-baseline gap-2 font-mono text-xs tabular-nums text-ink-faint">
                          <span>
                            {it.quantity} × {formatMoney(it.unit_price, invoice.currency)}
                          </span>
                          {Number(it.discount) > 0 && <span className="text-brass-600">-{it.discount}%</span>}
                        </span>
                        <span className="whitespace-nowrap font-mono text-base font-semibold tabular-nums text-ink">
                          {formatMoney(lineAmount(it), invoice.currency)}
                        </span>
                      </div>
                      <div className="mt-3 min-w-0">
                        {titulo && <p className="break-words text-sm font-semibold leading-snug text-ink">{titulo}</p>}
                        {cuerpo && (
                          <p
                            className={`whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft ${
                              titulo ? 'mt-1.5' : ''
                            }`}
                          >
                            {cuerpo}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-5 py-3 sm:grid sm:grid-cols-[1fr_80px_120px_120px]"
                  >
                    <span className="min-w-0 flex-1 whitespace-pre-line break-words text-sm text-ink">
                      {it.description}
                      {Number(it.discount) > 0 && <span className="ml-1.5 text-xs text-brass-600">-{it.discount}%</span>}
                    </span>
                    <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">{it.quantity}</span>
                    <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">
                      {formatMoney(it.unit_price, invoice.currency)}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-right font-mono text-sm font-medium text-ink">
                      {formatMoney(lineAmount(it), invoice.currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {receipts.length > 0 && (
            <Card title={t('factura.recibos')}>
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
                      <button
                        onClick={() => handleReceiptDownload(r)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
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
          <Card title={t('factura.resumen')}>
            <div className="space-y-2 font-mono text-sm">
              <Row label={t('factura.subtotal')} value={formatMoney(invoice.subtotal, invoice.currency)} />
              {invoice.discount_amount > 0 && (
                <Row
                  label={t('factura.descuento')}
                  value={`-${formatMoney(invoice.discount_amount, invoice.currency)}`}
                />
              )}
              {invoice.tax_amount > 0 && (
                <Row
                  label={t('factura.impuesto', { tasa: invoice.tax_rate })}
                  value={formatMoney(invoice.tax_amount, invoice.currency)}
                />
              )}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <span className="font-sans text-sm font-semibold text-ink">{t('factura.total')}</span>
                <span className="text-base font-semibold text-brand-600">
                  {formatMoney(invoice.total, invoice.currency)}
                </span>
              </div>
              <Row label={t('factura.pagado')} value={formatMoney(invoice.paid_amount, invoice.currency)} />
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="font-sans text-sm font-semibold text-ink">{t('factura.saldo')}</span>
                <span className={`font-semibold ${saldo > 0 ? 'text-ink' : 'text-teal-600'}`}>
                  {formatMoney(saldo, invoice.currency)}
                </span>
              </div>
            </div>
          </Card>

          {!anulada && (
            <button onClick={anular} className="text-sm font-medium text-rust-500 hover:text-rust-500/80">
              {t('factura.anular')}
            </button>
          )}
        </div>
      </div>

      {payOpen && (
        <PaymentModal
          saldo={saldo}
          currency={invoice.currency}
          onClose={() => setPayOpen(false)}
          onSave={registerPayment}
        />
      )}
      {editOpen && (
        <EditarFacturaModal invoice={invoice} onClose={() => setEditOpen(false)} onSave={guardarEdicion} />
      )}
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

/**
 * Editar un comprobante ya emitido.
 *
 * ⚠ POR QUÉ LOS IMPORTES SE BLOQUEAN CUANDO HAY PAGOS
 *   Cada pago registrado generó un recibo en PDF que ya está en manos del
 *   cliente, y ese papel dice un monto. Si acá se cambiara el total del
 *   comprobante, el recibo pasaría a contradecirlo y el saldo quedaría
 *   calculado sobre un número que nadie firmó. Para eso está anular y
 *   emitir uno nuevo: deja las dos versiones a la vista en lugar de
 *   reescribir la historia.
 *
 *   Mientras no se cobró nada, en cambio, corregir un ítem mal cargado es
 *   justamente lo que uno quiere poder hacer.
 */
function EditarFacturaModal({ invoice, onClose, onSave }) {
  const { t } = useTranslation()
  const conPagos = Number(invoice.paid_amount) > 0
  const [form, setForm] = useState({
    issue_date: invoice.issue_date || '',
    reference: invoice.reference || '',
    payment_terms: invoice.payment_terms || '',
    payment_methods: invoice.payment_methods || '',
    delivery_time: invoice.delivery_time || '',
    notes: invoice.notes || '',
    terms: invoice.terms || ''
  })
  const [items, setItems] = useState(invoice.items || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totales = calculateTotals({
    items,
    discountType: invoice.discount_type,
    discountValue: invoice.discount_value,
    taxRate: invoice.tax_rate,
    deposit: invoice.deposit
  })

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const cambios = { ...form }
    if (!conPagos) {
      cambios.items = items
      cambios.subtotal = totales.subtotal
      cambios.discount_amount = totales.discountAmount
      cambios.tax_amount = totales.taxAmount
      cambios.total = totales.total
    }

    const err = await onSave(cambios)
    if (err) setError(err.message || t('factura.errorGuardar'))
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:p-8">
      <form
        onSubmit={submit}
        className="relative w-full max-w-2xl rounded-xl2 border border-line bg-surface p-6 shadow-soft"
      >
        <h2 className="font-display text-xl font-medium text-ink">{t('factura.editarTitulo')}</h2>
        <p className="mt-1 text-xs text-ink-soft">{t('factura.editarBajada')}</p>

        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label={t('factura.fechaEmision')}>
              <input
                type="date"
                value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                className={entradaCls}
              />
            </Campo>
            <Campo label={t('factura.referencia')}>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className={entradaCls}
              />
            </Campo>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">{t('factura.items')}</p>
            {conPagos ? (
              <p className="rounded-md border border-brass-500/40 bg-brass-500/[0.08] px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                {t('factura.itemsBloqueados')}
              </p>
            ) : (
              <>
                <ItemsTable items={items} onChange={setItems} currency={invoice.currency} />
                <p className="mt-2 text-right font-mono text-sm text-ink-soft">
                  {t('factura.total')}:{' '}
                  <span className="font-semibold text-ink">
                    {formatMoney(totales.total, invoice.currency)}
                  </span>
                </p>
              </>
            )}
          </div>

          <Campo label={t('factura.condicionesPago')}>
            <textarea
              rows={4}
              value={form.payment_terms}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
              className={entradaCls}
            />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label={t('factura.formasPago')}>
              <textarea
                rows={2}
                value={form.payment_methods}
                onChange={(e) => setForm({ ...form, payment_methods: e.target.value })}
                className={entradaCls}
              />
            </Campo>
            <Campo label={t('factura.plazoEntrega')}>
              <input
                type="text"
                value={form.delivery_time}
                onChange={(e) => setForm({ ...form, delivery_time: e.target.value })}
                className={entradaCls}
              />
            </Campo>
          </div>

          <Campo label={t('factura.notas')}>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={entradaCls}
            />
          </Campo>
          <Campo label={t('factura.condiciones')}>
            <textarea
              rows={3}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              className={entradaCls}
            />
          </Campo>
        </div>

        {error && <p className="mt-4 rounded-md bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 rounded-md py-2.5 text-sm font-semibold">
            {saving ? t('comun.guardando') : t('comun.guardar')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-soft"
          >
            {t('comun.cancelar')}
          </button>
        </div>
      </form>
    </div>
  )
}

const entradaCls =
  'w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

function PaymentModal({ saldo, currency, onClose, onSave }) {
  const { t } = useTranslation()
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
        <h2 className="font-display text-xl font-medium text-ink">{t('factura.registrarPago')}</h2>
        <p className="mt-1 text-xs text-ink-soft">{t('factura.reciboAutomatico')}</p>
        <div className="mt-4 space-y-3">
          <Campo label={t('factura.montoConMoneda', { moneda: currency })}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-right font-mono text-sm focus:border-brand-500 focus:outline-none"
            />
          </Campo>
          <Campo label={t('factura.formaPago')}>
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder={t('factura.formaPagoEjemplo')}
              className={entradaCls}
            />
          </Campo>
          <Campo label={t('factura.concepto')}>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={t('factura.conceptoEjemplo')}
              className={entradaCls}
            />
          </Campo>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 rounded-md py-2.5 text-sm font-semibold">
            {saving ? t('comun.guardando') : t('factura.registrarYDescargar')}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-soft">
            {t('comun.cancelar')}
          </button>
        </div>
      </form>
    </div>
  )
}
