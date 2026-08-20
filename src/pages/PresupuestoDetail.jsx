import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { FileText, Send } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../hooks/usePlan'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { cleanDetails } from '../components/BudgetDetails'
import CompartirModal from '../components/CompartirModal'
import { downloadBudgetPdf, generateBudgetPdfBlob } from '../lib/pdf'
import { formatDate, formatMoney, formatNumero, STATUS_OPTIONS, safeImages, safePdfUrl, storagePathFromUrl } from '../lib/utils'
import { CLAVES, marcar } from '../lib/onboarding'

export default function PresupuestoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { isPremium } = usePlan()

  const [budget, setBudget] = useState(null)
  const [items, setItems] = useState([])
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [compartiendo, setCompartiendo] = useState(false)
  const [qr, setQr] = useState('')
  const [invoiceId, setInvoiceId] = useState(null)
  const [pdfError, setPdfError] = useState('')

  useEffect(() => {
    if (!user || !id) return
    supabase
      .from('invoices')
      .select('id')
      .eq('budget_id', id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setInvoiceId(data?.id || null))
  }, [id, user])

  const handleConvertInvoice = async () => {
    if (invoiceId) {
      navigate(`/facturas/${invoiceId}`)
      return
    }
    setBusy(true)
    try {
      const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      const numero = (count || 0) + 1
      const itemsSnap = items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
        discount: Number(it.discount) || 0
      }))
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          budget_id: budget.id,
          client_id: budget.client_id,
          numero,
          issue_date: new Date().toISOString().slice(0, 10),
          currency: budget.currency,
          reference: budget.reference || '',
          discount_type: budget.discount_type,
          discount_value: budget.discount_value,
          tax_rate: budget.tax_rate,
          deposit: budget.deposit || 0,
          subtotal: budget.subtotal,
          discount_amount: budget.discount_amount,
          tax_amount: budget.tax_amount,
          total: budget.total,
          notes: budget.notes,
          terms: budget.terms,
          payment_terms: budget.payment_terms,
          payment_methods: budget.payment_methods,
          delivery_time: budget.delivery_time,
          items: itemsSnap,
          status: 'emitida'
        })
        .select()
        .single()
      if (error) throw error
      navigate(`/facturas/${data.id}`)
    } catch (err) {
      window.alert(err.message || 'No se pudo crear el comprobante. ¿Ejecutaste la migración 06?')
    } finally {
      setBusy(false)
    }
  }

  const publicUrl = budget?.public_token ? `${window.location.origin}/p/${budget.public_token}` : ''

  useEffect(() => {
    if (!publicUrl) return
    QRCode.toDataURL(publicUrl, { width: 220, margin: 1, color: { dark: '#1B3B6F', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [publicUrl])

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const { data: b } = await supabase.from('budgets').select('*').eq('id', id).single()
      if (!active || !b) return
      const [{ data: its }, { data: c }] = await Promise.all([
        supabase.from('budget_items').select('*').eq('budget_id', id).order('position'),
        b.client_id ? supabase.from('clients').select('*').eq('id', b.client_id).single() : Promise.resolve({ data: null })
      ])
      if (!active) return
      setBudget(b)
      setItems(its || [])
      setClient(c)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [id, user])

  const handleDownload = async () => {
    setBusy(true)
    setPdfError('')
    try {
      await downloadBudgetPdf({ budget, items, client, profile })
    } catch (err) {
      setPdfError(err?.message || 'No se pudo generar el PDF del presupuesto.')
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    setBusy(true)
    setPdfError('')
    try {
      const blob = await generateBudgetPdfBlob({ budget, items, client, profile })
      const file = new File([blob], `${formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)}.pdf`, { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Presupuesto ${formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)}`,
          text: `Presupuesto de ${profile?.business_name || ''} para ${client?.name || ''}`
        })
      } else {
        await downloadBudgetPdf({ budget, items, client, profile })
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        // Si compartir falla, al menos intentamos la descarga.
        try {
          await downloadBudgetPdf({ budget, items, client, profile })
        } catch (err2) {
          setPdfError(err2?.message || 'No se pudo generar el PDF del presupuesto.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const handleStatusChange = async (status) => {
    const { error } = await supabase.from('budgets').update({ status }).eq('id', id)
    if (!error) setBudget((b) => ({ ...b, status }))
  }

  const handleDuplicate = async () => {
    setBusy(true)
    try {
      const { count } = await supabase
        .from('budgets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      const {
        id: _oldId,
        created_at,
        updated_at,
        numero,
        public_token,
        viewed_at,
        accepted_at,
        rejected_at,
        clients: _clients,
        ...rest
      } = budget
      const { data: newBudget, error } = await supabase
        .from('budgets')
        // La copia no se lleva las imágenes: son el mismo archivo en el
        // Storage y, si después borrás una de las dos copias, la foto
        // desaparecería también de la otra.
        .insert({ ...rest, images: [], status: 'enviado', numero: (count || 0) + 1 })
        .select()
        .single()
      if (error) throw error
      const itemsPayload = items.map((it, index) => ({
        budget_id: newBudget.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount,
        position: index
      }))
      await supabase.from('budget_items').insert(itemsPayload)
      navigate(`/presupuestos/${newBudget.id}`)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este presupuesto? Esta acción no se puede deshacer.')) return
    setBusy(true)
    // Las imágenes adjuntas no se borran solas: sin esto, una foto que el
    // usuario cree eliminada sigue online para cualquiera que tenga la URL.
    const paths = [...safeImages(budget.images), safePdfUrl(budget.pdf_url)]
      .filter(Boolean)
      .map((u) => storagePathFromUrl(u, 'adjuntos'))
      .filter(Boolean)
    if (paths.length) await supabase.storage.from('adjuntos').remove(paths)
    await supabase.from('budgets').delete().eq('id', id)
    navigate('/presupuestos')
  }

  if (loading || !budget) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  // El mensaje va firmado con el nombre del negocio: el cliente tiene que
  // saber de quién es el presupuesto antes de abrir el link, y quien lo
  // abre ve además el logo en la vista previa (api/preview.js).
  const numeroTexto = formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)
  const asunto = `Presupuesto ${numeroTexto}${profile?.business_name ? ' · ' + profile.business_name : ''}`
  const saludo = `Hola${client?.name ? ' ' + client.name : ''}, te comparto el presupuesto ${numeroTexto}${
    profile?.business_name ? ' de ' + profile.business_name : ''
  }: ${publicUrl}`

  return (
    <div>
      <Link to="/presupuestos" className="text-sm text-ink-soft hover:text-ink">
        ← Presupuestos
      </Link>

      <header className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-medium text-ink">
              {budget.title || client?.name || formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)}
            </h1>
            <StatusBadge status={budget.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)} · {client?.name || 'Sin cliente'} · Emitido el {formatDate(budget.issue_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/presupuestos/${id}/editar`}
            className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink-faint"
          >
            Editar
          </Link>
          {isPremium && (
            <button
              onClick={handleConvertInvoice}
              disabled={busy}
              className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
            >
              {invoiceId ? 'Ver factura' : 'Convertir en factura'}
            </button>
          )}
          {/* Mandarlo es lo que el usuario viene a hacer: un solo botón,
              y adentro elige por dónde. */}
          <button
            onClick={() => {
              marcar(CLAVES.yaCompartio) // tacha el último paso de la guía
              setCompartiendo(true)
            }}
            disabled={busy}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          >
            <Send size={15} aria-hidden="true" />
            {busy ? 'Preparando…' : 'Compartir'}
          </button>
        </div>
      </header>

      {pdfError && (
        <p className="mt-3 rounded-md border border-rust-500/40 bg-rust-500/[0.08] px-3 py-2 text-xs text-rust-500">
          {pdfError}
        </p>
      )}

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
              {items.map((it) => {
                const lineBase = it.quantity * it.unit_price
                const lineTotal = lineBase - lineBase * ((it.discount || 0) / 100)
                return (
                  <div key={it.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:grid sm:grid-cols-[1fr_80px_120px_120px]">
                    <span className="min-w-0 flex-1 break-words text-sm text-ink">
                      {it.description}
                      {it.discount > 0 && <span className="ml-1.5 text-xs text-brass-600">-{it.discount}%</span>}
                    </span>
                    <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">{it.quantity}</span>
                    <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">
                      {formatMoney(it.unit_price, budget.currency)}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-right font-mono text-sm font-medium text-ink">
                      {formatMoney(lineTotal, budget.currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {(budget.notes || budget.terms) && (
            <div className="rounded-xl2 border border-line bg-surface p-5">
              {budget.notes && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Notas</p>
                  <p className="mt-1 text-sm text-ink-soft">{budget.notes}</p>
                </div>
              )}
              {budget.terms && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Condiciones</p>
                  <p className="mt-1 text-sm text-ink-soft">{budget.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl2 border border-line bg-surface p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Resumen</p>
            <div className="mt-3 space-y-2 font-mono text-sm">
              <Row label="Subtotal" value={formatMoney(budget.subtotal, budget.currency)} />
              {budget.discount_amount > 0 && <Row label="Descuento" value={`-${formatMoney(budget.discount_amount, budget.currency)}`} />}
              {budget.tax_amount > 0 && <Row label={`Impuesto (${budget.tax_rate}%)`} value={formatMoney(budget.tax_amount, budget.currency)} />}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <span className="font-sans text-sm font-semibold text-ink">Total</span>
                <span className="text-base font-semibold text-brand-600">{formatMoney(budget.total, budget.currency)}</span>
              </div>
              {Number(budget.deposit) > 0 && (
                <>
                  <Row label="Anticipo / seña" value={`-${formatMoney(budget.deposit, budget.currency)}`} />
                  <div className="flex items-center justify-between border-t border-line pt-2">
                    <span className="font-sans text-sm font-semibold text-ink">Saldo</span>
                    <span className="font-semibold text-ink">
                      {formatMoney((Number(budget.total) || 0) - (Number(budget.deposit) || 0), budget.currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Al costado ya no se comparte nada: acá solo se ve qué hizo el
              cliente con el enlace, que es lo que uno vuelve a mirar. */}
          {publicUrl && isPremium && (
            <div className="rounded-xl2 border border-line bg-surface p-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Seguimiento
              </p>
              {budget.viewed_at || budget.accepted_at || budget.rejected_at ? (
                <div className="space-y-1 text-sm">
                  {budget.viewed_at && (
                    <p className="text-ink-soft">👁 Visto el {formatDate(budget.viewed_at.slice(0, 10))}</p>
                  )}
                  {budget.accepted_at && (
                    <p className="font-medium text-teal-600">✓ Aceptado el {formatDate(budget.accepted_at.slice(0, 10))}</p>
                  )}
                  {budget.rejected_at && (
                    <p className="font-medium text-rust-500">✗ Rechazado el {formatDate(budget.rejected_at.slice(0, 10))}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-soft">
                  El cliente todavía no abrió el enlace. Te avisamos acá cuando lo vea.
                </p>
              )}
            </div>
          )}

          {publicUrl && !isPremium && (
            <Link to="/premium" className="block rounded-xl2 border border-dashed border-brand-500/40 bg-brand-500/[0.04] p-5 text-center transition hover:bg-brand-500/[0.07]">
              <p className="text-sm font-semibold text-brand-700">🔒 Enlace público + QR</p>
              <p className="mt-1 text-xs text-ink-soft">Compartí un link para que el cliente vea y acepte online. Función premium.</p>
            </Link>
          )}

          <div className="rounded-xl2 border border-line bg-surface p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Cambiar estado</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={s === budget.status}
                  className="disabled:pointer-events-none"
                >
                  <StatusBadge status={s} className={s === budget.status ? '' : 'opacity-40 hover:opacity-70'} />
                </button>
              ))}
            </div>
          </div>

          {cleanDetails(budget.details).length > 0 && (
            <div className="rounded-xl2 border border-line bg-surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Datos del trabajo</p>
              <dl className="mt-2 space-y-1.5">
                {cleanDetails(budget.details).map((d) => (
                  <div key={d.label} className="flex justify-between gap-3 text-sm">
                    <dt className="shrink-0 text-ink-soft">{d.label}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {safePdfUrl(budget.pdf_url) && (
            <a
              href={safePdfUrl(budget.pdf_url)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl2 border border-line bg-surface p-5 transition hover:border-ink-faint"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rust-500/10 text-rust-500">
                <FileText size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">Tu PDF</span>
                <span className="block text-xs text-ink-soft">
                  El cliente lo abre desde el enlace. Tocá para verlo.
                </span>
              </span>
            </a>
          )}

          {safeImages(budget.images).length > 0 && (
            <div className="rounded-xl2 border border-line bg-surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Imágenes</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {safeImages(budget.images).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="" loading="lazy" className="aspect-square w-full rounded-lg border border-line object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {client && (
            <div className="rounded-xl2 border border-line bg-surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Cliente</p>
              {client.logo_url && (
                <img src={client.logo_url} alt="" className="mt-2 h-10 max-w-[140px] object-contain" />
              )}
              <p className="mt-1.5 text-sm font-semibold text-ink">{client.name}</p>
              {client.email && <p className="break-all text-sm text-ink-soft">{client.email}</p>}
              {client.phone && <p className="text-sm text-ink-soft">{client.phone}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={handleDuplicate} disabled={busy} className="text-sm font-medium text-ink-soft hover:text-ink">
              Duplicar
            </button>
            <span className="text-ink-faint">·</span>
            <button onClick={handleDelete} disabled={busy} className="text-sm font-medium text-rust-500 hover:text-rust-500/80">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {compartiendo && (
        <CompartirModal
          onClose={() => setCompartiendo(false)}
          publicUrl={publicUrl}
          qr={qr}
          saludo={saludo}
          asunto={asunto}
          cliente={client}
          esPremium={isPremium}
          pdfPropio={safePdfUrl(budget.pdf_url)}
          ocupado={busy}
          onDescargarPdf={async () => {
            setCompartiendo(false)
            await handleDownload()
          }}
          onEnviarPdf={async () => {
            setCompartiendo(false)
            await handleShare()
          }}
        />
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
