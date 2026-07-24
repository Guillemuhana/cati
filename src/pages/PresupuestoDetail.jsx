import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { downloadBudgetPdf, generateBudgetPdfBlob } from '../lib/pdf'
import { formatDate, formatMoney, formatNumero } from '../lib/utils'

export default function PresupuestoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [budget, setBudget] = useState(null)
  const [items, setItems] = useState([])
  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

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
    try {
      await downloadBudgetPdf({ budget, items, client, profile })
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    setBusy(true)
    try {
      const blob = await generateBudgetPdfBlob({ budget, items, client, profile })
      const file = new File([blob], `${formatNumero(budget.numero)}.pdf`, { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Presupuesto ${formatNumero(budget.numero)}`,
          text: `Presupuesto de ${profile?.business_name || ''} para ${client?.name || ''}`
        })
      } else {
        await downloadBudgetPdf({ budget, items, client, profile })
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        await downloadBudgetPdf({ budget, items, client, profile })
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
      const { id: _oldId, created_at, updated_at, numero, ...rest } = budget
      const { data: newBudget, error } = await supabase
        .from('budgets')
        .insert({ ...rest, status: 'borrador', numero: (count || 0) + 1 })
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
    await supabase.from('budgets').delete().eq('id', id)
    navigate('/presupuestos')
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (loading || !budget) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <Link to="/presupuestos" className="text-sm text-ink-soft hover:text-ink">
        ← Presupuestos
      </Link>

      <header className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-medium text-ink">
              {budget.title || client?.name || formatNumero(budget.numero)}
            </h1>
            <StatusBadge status={budget.status} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {formatNumero(budget.numero)} · {client?.name || 'Sin cliente'} · Emitido el {formatDate(budget.issue_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/presupuestos/${id}/editar`}
            className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink-faint"
          >
            Editar
          </Link>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
          >
            Descargar PDF
          </button>
          <button
            onClick={handleShare}
            disabled={busy}
            className="btn-primary rounded-md px-3.5 py-2 text-sm font-semibold"
          >
            Compartir PDF
          </button>
        </div>
      </header>

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
                    <span className="flex-1 text-sm text-ink">
                      {it.description}
                      {it.discount > 0 && <span className="ml-1.5 text-xs text-brass-600">-{it.discount}%</span>}
                    </span>
                    <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">{it.quantity}</span>
                    <span className="hidden text-right font-mono text-sm text-ink-soft sm:block">
                      {formatMoney(it.unit_price, budget.currency)}
                    </span>
                    <span className="text-right font-mono text-sm font-medium text-ink">
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
            </div>
          </div>

          <div className="rounded-xl2 border border-line bg-surface p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Cambiar estado</p>
            <div className="flex flex-wrap gap-1.5">
              {['borrador', 'enviado', 'aprobado', 'rechazado', 'vencido'].map((s) => (
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

          {client && (
            <div className="rounded-xl2 border border-line bg-surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Cliente</p>
              <p className="mt-1.5 text-sm font-semibold text-ink">{client.name}</p>
              {client.email && <p className="text-sm text-ink-soft">{client.email}</p>}
              {client.phone && <p className="text-sm text-ink-soft">{client.phone}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={handleDuplicate} disabled={busy} className="text-sm font-medium text-ink-soft hover:text-ink">
              Duplicar
            </button>
            <span className="text-ink-faint">·</span>
            <button onClick={copyLink} className="text-sm font-medium text-ink-soft hover:text-ink">
              {copied ? 'Enlace copiado' : 'Copiar enlace'}
            </button>
            <span className="text-ink-faint">·</span>
            <button onClick={handleDelete} disabled={busy} className="text-sm font-medium text-rust-500 hover:text-rust-500/80">
              Eliminar
            </button>
          </div>
        </div>
      </div>
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
