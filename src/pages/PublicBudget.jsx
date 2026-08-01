import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import Spinner from '../components/Spinner'
import { formatMoney, formatDate, formatNumero } from '../lib/utils'
import { lineAmount } from '../components/ItemsTable'

export default function PublicBudget() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: res, error } = await supabase.rpc('get_public_budget', { p_token: token })
      if (!active) return
      if (error || !res) setNotFound(true)
      else setData(res)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [token])

  const respond = async (action) => {
    if (responding) return
    setResponding(true)
    const { data: res } = await supabase.rpc('set_budget_response', { p_token: token, p_action: action })
    if (res?.ok) setData((d) => ({ ...d, budget: { ...d.budget, status: res.status } }))
    setResponding(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
        <img src="/numera-icon.svg" alt="Numera" className="mb-4 h-12 w-12" />
        <h1 className="font-display text-xl font-medium text-ink">Presupuesto no encontrado</h1>
        <p className="mt-1 text-sm text-ink-soft">El enlace puede haber cambiado o ya no está disponible.</p>
      </div>
    )
  }

  const { budget, items, business } = data
  const accent = business?.brand_color || '#2F6BFF'
  const currency = budget.currency
  const balance = (Number(budget.total) || 0) - (Number(budget.deposit) || 0)
  const decided = budget.status === 'aceptado' || budget.status === 'rechazado'

  return (
    <div className="min-h-dvh bg-paper py-6 sm:py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="overflow-hidden rounded-xl2 border border-line bg-surface shadow-soft">
          <div className="h-1.5" style={{ background: accent }} />
          <div className="p-4 sm:p-10">
            {/* Encabezado */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {business?.logo_url ? (
                  <img src={business.logo_url} alt="" className="mb-2 h-12 w-12 object-contain" />
                ) : (
                  <img src="/numera-icon.svg" alt="" className="mb-2 h-12 w-12" />
                )}
                <p className="break-words font-display text-lg font-semibold text-ink">
                  {business?.business_name || 'Presupuesto'}
                </p>
                {business?.tax_id && <p className="break-words text-xs text-ink-soft">{business.tax_id}</p>}
                {business?.email && <p className="break-all text-xs text-ink-soft">{business.email}</p>}
                {business?.phone && <p className="text-xs text-ink-soft">{business.phone}</p>}
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="font-display text-xl font-medium sm:text-2xl" style={{ color: accent }}>
                  Presupuesto
                </p>
                <p className="mt-0.5 font-mono text-sm text-ink-soft">{formatNumero(budget.numero, budget.issue_date)}</p>
              </div>
            </header>

            {/* Meta */}
            <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Emisión</p>
                <p className="mt-1 text-ink">{formatDate(budget.issue_date)}</p>
              </div>
              {budget.due_date && (
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Válido hasta</p>
                  <p className="mt-1 text-ink">{formatDate(budget.due_date)}</p>
                </div>
              )}
            </div>

            {/* Ítems */}
            <div className="mt-8 overflow-hidden rounded-lg border border-line">
              <div className="hidden grid-cols-[1fr_60px_minmax(90px,110px)_minmax(90px,110px)] gap-3 border-b border-line bg-paper px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint sm:grid">
                <span>Descripción</span>
                <span className="text-right">Cant.</span>
                <span className="text-right">Precio</span>
                <span className="text-right">Importe</span>
              </div>
              {items.map((it, i) => (
                <div
                  key={i}
                  className="border-b border-line px-3 py-3 text-sm last:border-0 sm:grid sm:grid-cols-[1fr_60px_minmax(90px,110px)_minmax(90px,110px)] sm:items-start sm:gap-3 sm:py-2"
                >
                  <span className="block min-w-0 break-words text-ink">
                    {it.description}
                    {Number(it.discount) > 0 && <span className="ml-1 text-xs text-brass-600">-{it.discount}%</span>}
                  </span>

                  {/* Móvil: cantidad × precio en una línea, importe a la derecha */}
                  <div className="mt-1.5 flex items-baseline justify-between gap-3 sm:hidden">
                    <span className="font-mono text-xs text-ink-soft">
                      {it.quantity} × {formatMoney(it.unit_price, currency)}
                    </span>
                    <span className="whitespace-nowrap font-mono font-medium text-ink">
                      {formatMoney(lineAmount(it), currency)}
                    </span>
                  </div>

                  {/* Escritorio: columnas */}
                  <span className="hidden text-right font-mono text-ink-soft sm:block">{it.quantity}</span>
                  <span className="hidden whitespace-nowrap text-right font-mono text-ink-soft sm:block">
                    {formatMoney(it.unit_price, currency)}
                  </span>
                  <span className="hidden whitespace-nowrap text-right font-mono font-medium text-ink sm:block">
                    {formatMoney(lineAmount(it), currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 font-mono text-sm">
                <Row label="Subtotal" value={formatMoney(budget.subtotal, currency)} />
                {Number(budget.discount_amount) > 0 && <Row label="Descuento" value={`-${formatMoney(budget.discount_amount, currency)}`} />}
                {Number(budget.tax_amount) > 0 && <Row label={`Impuesto (${budget.tax_rate}%)`} value={formatMoney(budget.tax_amount, currency)} />}
                <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
                  <span className="font-sans font-semibold text-ink">Total</span>
                  <span className="whitespace-nowrap text-base font-semibold" style={{ color: accent }}>
                    {formatMoney(budget.total, currency)}
                  </span>
                </div>
                {Number(budget.deposit) > 0 && (
                  <>
                    <Row label="Anticipo / seña" value={`-${formatMoney(budget.deposit, currency)}`} />
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-sans font-semibold text-ink">Saldo</span>
                      <span className="whitespace-nowrap font-semibold text-ink">{formatMoney(balance, currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pago / notas */}
            {(budget.payment_terms || budget.payment_methods || business?.bank_alias || budget.delivery_time || budget.notes || budget.terms) && (
              <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
                <Block title="Condiciones de pago" text={budget.payment_terms} />
                <Block title="Formas de pago" text={budget.payment_methods} />
                <Block title="Datos bancarios / alias" text={business?.bank_alias} />
                <Block title="Plazo de entrega" text={budget.delivery_time} />
                <Block title="Notas" text={budget.notes} />
                <Block title="Condiciones" text={budget.terms} />
              </div>
            )}

            {/* Términos y condiciones del negocio */}
            {business?.legal_terms?.trim() && (
              <div className="mt-8 border-t border-line pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Términos y condiciones
                </p>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                  {business.legal_terms.trim()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Acciones del cliente */}
        <div className="mt-4 rounded-xl2 border border-line bg-surface p-5 text-center shadow-soft">
          {decided ? (
            <p className="text-sm font-medium" style={{ color: budget.status === 'aceptado' ? '#189B84' : '#B4483A' }}>
              {budget.status === 'aceptado' ? '✓ Aceptaste este presupuesto. ¡Gracias!' : 'Rechazaste este presupuesto.'}
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-soft">¿Querés avanzar con este presupuesto?</p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row">
                <button
                  onClick={() => respond('aceptado')}
                  disabled={responding}
                  className="rounded-md px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition disabled:opacity-60"
                  style={{ background: accent }}
                >
                  {responding ? 'Enviando…' : 'Aceptar presupuesto'}
                </button>
                <button
                  onClick={() => respond('rechazado')}
                  disabled={responding}
                  className="rounded-md border border-line px-6 py-2.5 text-sm font-medium text-ink-soft transition hover:border-rust-500 hover:text-rust-500 disabled:opacity-60"
                >
                  Rechazar
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">
          {business?.hide_branding ? business?.business_name : 'Hecho con Numera'}
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-ink-soft">
      <span>{label}</span>
      <span className="whitespace-nowrap text-ink">{value}</span>
    </div>
  )
}

function Block({ title, text }) {
  if (!text) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{title}</p>
      <p className="mt-1 whitespace-pre-line break-words text-ink-soft">{text}</p>
    </div>
  )
}
