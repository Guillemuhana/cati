import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ItemsTable, { newItem } from '../components/ItemsTable'
import ClientPicker from '../components/ClientPicker'
import ProductPicker from '../components/ProductPicker'
import { usePlan } from '../hooks/usePlan'
import Card from '../components/Card'
import PreviewModal from '../components/PreviewModal'
import Spinner from '../components/Spinner'
import { downloadBudgetPdf, generateBudgetPdfBlob } from '../lib/pdf'
import {
  CURRENCIES,
  TAX_PRESETS,
  VALIDITY_PRESETS,
  STATUS_OPTIONS,
  STATUS,
  calculateTotals,
  formatMoney,
  formatNumero,
  addDays,
  getBudgetErrors
} from '../lib/utils'

const emptyBudget = {
  client_id: '',
  title: '',
  reference: '',
  status: 'borrador',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  currency: 'ARS',
  discount_type: 'none',
  discount_value: 0,
  tax_rate: 0,
  deposit: 0,
  notes: '',
  terms: 'Presupuesto válido por 15 días. Los precios no incluyen posibles ajustes por cambios de alcance.',
  payment_terms: '',
  payment_methods: '',
  delivery_time: ''
}

export default function PresupuestoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { isPremium } = usePlan()

  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [templates, setTemplates] = useState([])
  const [budget, setBudget] = useState(emptyBudget)
  const [items, setItems] = useState([newItem()])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [savedMsg, setSavedMsg] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const dirtyRef = useRef(false)
  const prefilledRef = useRef(false)

  const markDirty = () => {
    dirtyRef.current = true
    setSavedMsg('')
  }
  const patchBudget = (patch) => {
    setBudget((b) => ({ ...b, ...patch }))
    markDirty()
  }
  const handleItems = (next) => {
    setItems(next.length ? next : [newItem()])
    markDirty()
  }

  // Cargar clientes, catálogo y plantillas
  const loadTemplates = () =>
    supabase
      .from('budget_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setTemplates(data || []))

  useEffect(() => {
    if (!user) return
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data || []))
    supabase.from('products').select('*').order('name').then(({ data }) => setProducts(data || []))
    loadTemplates()
  }, [user])

  // Insertar un ítem desde el catálogo
  const pickProduct = (p) => {
    const item = { ...newItem(), description: p.name, unit_price: Number(p.unit_price) || 0, quantity: 1 }
    setItems((prev) => {
      const firstEmpty =
        prev.length === 1 && !(prev[0].description || '').trim() && !Number(prev[0].unit_price)
      return firstEmpty ? [item] : [...prev, item]
    })
    markDirty()
  }

  // Guardar el presupuesto actual como plantilla reutilizable
  const saveTemplate = async () => {
    const name = window.prompt('Nombre de la plantilla:')
    if (!name || !name.trim()) return
    const data = {
      budget: {
        title: budget.title,
        currency: budget.currency,
        discount_type: budget.discount_type,
        discount_value: budget.discount_value,
        tax_rate: budget.tax_rate,
        deposit: budget.deposit,
        notes: budget.notes,
        terms: budget.terms,
        payment_terms: budget.payment_terms,
        payment_methods: budget.payment_methods,
        delivery_time: budget.delivery_time
      },
      items: items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount
      }))
    }
    const { error: err } = await supabase.from('budget_templates').insert({ user_id: user.id, name: name.trim(), data })
    if (err) {
      setError(isMissingColumn(err) ? 'Ejecutá la migración 03 en Supabase para usar plantillas.' : err.message)
      return
    }
    setSavedMsg('Plantilla guardada')
    loadTemplates()
  }

  // Aplicar una plantilla (no pisa cliente ni fechas actuales)
  const applyTemplate = (tplId) => {
    const tpl = templates.find((t) => t.id === tplId)
    if (!tpl) return
    const d = tpl.data || {}
    if (d.budget) setBudget((b) => ({ ...b, ...d.budget }))
    if (Array.isArray(d.items) && d.items.length) {
      setItems(
        d.items.map((it, i) => ({
          _key: `tpl-${tplId}-${i}`,
          description: it.description || '',
          quantity: it.quantity ?? 1,
          unit_price: it.unit_price ?? 0,
          discount: it.discount ?? 0
        }))
      )
    }
    markDirty()
  }

  // Cargar presupuesto en edición
  useEffect(() => {
    if (!isEdit || !user) return
    let active = true
    ;(async () => {
      const [{ data: b }, { data: its }] = await Promise.all([
        supabase.from('budgets').select('*').eq('id', id).single(),
        supabase.from('budget_items').select('*').eq('budget_id', id).order('position')
      ])
      if (!active) return
      if (b) setBudget({ ...emptyBudget, ...b })
      setItems(its && its.length ? its : [newItem()])
      prefilledRef.current = true
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [id, isEdit, user])

  // Prefill de defaults del negocio (solo presupuesto nuevo, una vez)
  useEffect(() => {
    if (isEdit || prefilledRef.current || !profile) return
    prefilledRef.current = true
    setBudget((b) => ({
      ...b,
      currency: profile.currency || b.currency,
      terms: profile.default_terms || b.terms,
      payment_terms: profile.default_payment_terms || '',
      payment_methods: profile.default_payment_methods || ''
    }))
  }, [profile, isEdit])

  // Aviso al cerrar/recargar con cambios sin guardar
  useEffect(() => {
    const handler = (e) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const totals = calculateTotals({
    items,
    discountType: budget.discount_type,
    discountValue: budget.discount_value,
    taxRate: budget.tax_rate,
    deposit: budget.deposit
  })

  const handleCreateClient = async (clientData) => {
    const { data, error: err } = await supabase
      .from('clients')
      .insert({ ...clientData, user_id: user.id })
      .select()
      .single()
    if (err) {
      setError(err.message)
      return null
    }
    setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  // Guardado central. mode: 'draft' | 'final'. after: 'editar' | 'detail' | 'download' | 'share'
  const handleSave = async ({ status, mode, after }) => {
    if (saving) return // evita doble envío
    setError('')

    if (mode === 'final') {
      const errs = getBudgetErrors({ ...budget, items })
      if (Object.keys(errs).length) {
        setErrors(errs)
        setError('Revisá los campos marcados en rojo.')
        return
      }
    }
    setErrors({})
    setSaving(true)

    try {
      const validItems = items.filter((it) => (it.description || '').trim() !== '' || Number(it.unit_price) > 0)

      const payload = {
        user_id: user.id,
        client_id: budget.client_id || null,
        title: budget.title,
        reference: budget.reference || '',
        status: status || budget.status,
        issue_date: budget.issue_date,
        due_date: budget.due_date || null,
        currency: budget.currency,
        discount_type: budget.discount_type,
        discount_value: Number(budget.discount_value) || 0,
        tax_rate: Number(budget.tax_rate) || 0,
        deposit: Number(budget.deposit) || 0,
        notes: budget.notes,
        terms: budget.terms,
        payment_terms: budget.payment_terms || '',
        payment_methods: budget.payment_methods || '',
        delivery_time: budget.delivery_time || '',
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total: totals.total,
        updated_at: new Date().toISOString()
      }

      let budgetId = id
      let numero = budget.numero

      if (isEdit) {
        const { error: updErr } = await supabase.from('budgets').update(payload).eq('id', id)
        if (updErr) throw updErr
        await supabase.from('budget_items').delete().eq('budget_id', id)
      } else {
        const { count } = await supabase
          .from('budgets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        numero = (count || 0) + 1
        payload.numero = numero
        const { data, error: insErr } = await supabase.from('budgets').insert(payload).select().single()
        if (insErr) throw insErr
        budgetId = data.id
      }

      const itemsPayload = validItems.map((it, index) => ({
        budget_id: budgetId,
        description: (it.description || '').trim() || 'Ítem',
        quantity: Math.max(0, Number(it.quantity) || 0),
        unit_price: Math.max(0, Number(it.unit_price) || 0),
        discount: Math.min(100, Math.max(0, Number(it.discount) || 0)),
        position: index
      }))
      if (itemsPayload.length) {
        const { error: itErr } = await supabase.from('budget_items').insert(itemsPayload)
        if (itErr) throw itErr
      }

      dirtyRef.current = false

      // Acción posterior
      if (after === 'download' || after === 'share') {
        const pdfData = {
          budget: { ...payload, id: budgetId, numero, subtotal: totals.subtotal, discount_amount: totals.discountAmount, tax_amount: totals.taxAmount, total: totals.total, deposit: totals.deposit, balance: totals.balance },
          items: itemsPayload,
          client: clients.find((c) => c.id === budget.client_id) || null,
          profile
        }
        if (after === 'download') {
          await downloadBudgetPdf(pdfData)
        } else {
          await shareBudget(pdfData)
        }
      }

      if (after === 'editar' && !isEdit) {
        navigate(`/presupuestos/${budgetId}/editar`, { replace: true })
        setSavedMsg('Borrador guardado')
      } else if (after === 'editar') {
        setSavedMsg('Cambios guardados')
      } else {
        navigate(`/presupuestos/${budgetId}`)
      }
    } catch (err) {
      if (isMissingColumn(err)) {
        setError('Faltan columnas nuevas en la base. Ejecutá la migración supabase/migration_02.sql en Supabase y volvé a intentar.')
      } else {
        setError(err.message || 'No se pudo guardar.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (dirtyRef.current && !window.confirm('Tenés cambios sin guardar. ¿Querés salir igualmente?')) return
    navigate('/presupuestos')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  const previewBudget = { ...budget, numero: budget.numero }

  return (
    <div className="pb-28 lg:pb-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/presupuestos" className="text-sm text-ink-soft hover:text-ink">
            ← Presupuestos
          </Link>
          <h1 className="mt-1 font-display text-3xl font-medium text-ink">
            {isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-1 font-mono text-sm text-ink-soft">
            {formatNumero(budget.numero || (isEdit ? 0 : undefined), budget.issue_date, profile?.number_prefix)}
          </p>
          {isPremium && templates.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value)
                e.target.value = ''
              }}
              defaultValue=""
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-soft focus:border-brand-500 focus:outline-none"
              aria-label="Usar plantilla"
            >
              <option value="">Usar plantilla…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {isPremium && (
            <button
              type="button"
              onClick={saveTemplate}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink"
            >
              Guardar como plantilla
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Datos generales">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Título (opcional)">
                <input
                  type="text"
                  placeholder="Ej: Rediseño de sitio web"
                  value={budget.title}
                  onChange={(e) => patchBudget({ title: e.target.value })}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label="Referencia interna (opcional)">
                <input
                  type="text"
                  placeholder="Ej: OC-2026-014"
                  value={budget.reference}
                  onChange={(e) => patchBudget({ reference: e.target.value })}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label="Fecha de emisión">
                <input
                  type="date"
                  value={budget.issue_date}
                  onChange={(e) => patchBudget({ issue_date: e.target.value })}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label="Válido hasta" error={errors.due_date}>
                <input
                  type="date"
                  value={budget.due_date}
                  min={budget.issue_date}
                  onChange={(e) => patchBudget({ due_date: e.target.value })}
                  className={inputCls}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VALIDITY_PRESETS.map((d) => (
                    <Chip
                      key={d}
                      active={budget.due_date === addDays(budget.issue_date, d)}
                      onClick={() => patchBudget({ due_date: addDays(budget.issue_date, d) })}
                    >
                      {d} días
                    </Chip>
                  ))}
                </div>
              </Labeled>
              <Labeled label="Moneda">
                <select value={budget.currency} onChange={(e) => patchBudget({ currency: e.target.value })} className={inputCls}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Estado">
                <select value={budget.status} onChange={(e) => patchBudget({ status: e.target.value })} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS[s].label}
                    </option>
                  ))}
                </select>
              </Labeled>
            </div>
          </Card>

          <Card title="Cliente" desc="Elegí un cliente o creá uno nuevo sin perder lo cargado.">
            <span className="mb-1.5 block text-sm font-medium text-ink">
              Cliente <span className="text-rust-500">*</span>
            </span>
            <ClientPicker
              clients={clients}
              value={budget.client_id}
              onChange={(clientId) => patchBudget({ client_id: clientId })}
              onCreateClient={handleCreateClient}
            />
            {errors.client_id && <FieldError>{errors.client_id}</FieldError>}
          </Card>

          <Card
            title="Productos o servicios"
            action={isPremium ? <ProductPicker products={products} currency={budget.currency} onPick={pickProduct} /> : null}
          >
            <ItemsTable items={items} onChange={handleItems} currency={budget.currency} />
            {errors.items && <FieldError>{errors.items}</FieldError>}
          </Card>

          <Card title="Descuentos e impuestos">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Tipo de descuento">
                <select
                  value={budget.discount_type}
                  onChange={(e) => patchBudget({ discount_type: e.target.value })}
                  className={inputCls}
                >
                  <option value="none">Sin descuento</option>
                  <option value="percent">Porcentaje</option>
                  <option value="fixed">Monto fijo</option>
                </select>
              </Labeled>
              {budget.discount_type !== 'none' && (
                <Labeled
                  label={budget.discount_type === 'percent' ? 'Descuento (%)' : 'Descuento (monto)'}
                  error={errors.discount_value}
                >
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={budget.discount_type === 'percent' ? 100 : undefined}
                    value={budget.discount_value}
                    onChange={(e) => patchBudget({ discount_value: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </Labeled>
              )}
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-ink">IVA / Impuesto</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {TAX_PRESETS.map((t) => (
                    <Chip key={t.label} active={Number(budget.tax_rate) === t.value} onClick={() => patchBudget({ tax_rate: t.value })}>
                      {t.label}
                    </Chip>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={budget.tax_rate}
                      onChange={(e) => patchBudget({ tax_rate: e.target.value })}
                      className="w-24 rounded-md border border-line px-2.5 py-1.5 text-right font-mono text-sm focus:border-brand-500 focus:outline-none"
                      aria-label="Impuesto personalizado (%)"
                    />
                    <span className="text-sm text-ink-soft">% personalizado</span>
                  </div>
                </div>
              </div>
              <Labeled label="Anticipo / seña (opcional)">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={budget.deposit}
                  onChange={(e) => patchBudget({ deposit: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </Labeled>
            </div>
          </Card>

          <Card title="Notas, condiciones y pago">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Labeled label="Notas para el cliente">
                  <textarea
                    rows={3}
                    value={budget.notes}
                    onChange={(e) => patchBudget({ notes: e.target.value })}
                    placeholder="Ej: Incluye 2 rondas de revisión."
                    className={inputCls}
                  />
                </Labeled>
                <Labeled label="Condiciones">
                  <textarea rows={3} value={budget.terms} onChange={(e) => patchBudget({ terms: e.target.value })} className={inputCls} />
                </Labeled>
                <Labeled label="Condiciones de pago">
                  <textarea
                    rows={2}
                    value={budget.payment_terms}
                    onChange={(e) => patchBudget({ payment_terms: e.target.value })}
                    placeholder="Ej: 50% al aprobar, 50% contra entrega."
                    className={inputCls}
                  />
                </Labeled>
                <Labeled label="Formas de pago">
                  <textarea
                    rows={2}
                    value={budget.payment_methods}
                    onChange={(e) => patchBudget({ payment_methods: e.target.value })}
                    placeholder="Ej: Transferencia, efectivo, Mercado Pago."
                    className={inputCls}
                  />
                </Labeled>
                <Labeled label="Plazo estimado de entrega">
                  <input
                    type="text"
                    value={budget.delivery_time}
                    onChange={(e) => patchBudget({ delivery_time: e.target.value })}
                    placeholder="Ej: 15 días hábiles"
                    className={inputCls}
                  />
                </Labeled>
              </div>
              {profile?.bank_alias && (
                <p className="text-xs text-ink-faint">
                  Alias/datos bancarios de «Mi negocio» se incluyen automáticamente: <span className="text-ink-soft">{profile.bank_alias}</span>
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Resumen (sticky en desktop, en flujo en móvil) */}
        <div className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-20">
            <Card title="Resumen">
              <div className="space-y-2 font-mono text-sm">
                <Row label="Subtotal" value={formatMoney(totals.subtotal, budget.currency)} />
                {totals.discountAmount > 0 && <Row label="Descuento" value={`-${formatMoney(totals.discountAmount, budget.currency)}`} />}
                {totals.taxAmount > 0 && <Row label={`Impuesto (${budget.tax_rate}%)`} value={formatMoney(totals.taxAmount, budget.currency)} />}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-brand-500/[0.06] px-3 py-2">
                  <span className="font-sans text-sm font-semibold text-ink">Total</span>
                  <span className="font-sans text-xl font-semibold text-brand-700">{formatMoney(totals.total, budget.currency)}</span>
                </div>
                {totals.deposit > 0 && (
                  <>
                    <Row label="Anticipo / seña" value={`-${formatMoney(totals.deposit, budget.currency)}`} />
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <span className="font-sans text-sm font-semibold text-ink">Saldo pendiente</span>
                      <span className="font-semibold text-ink">{formatMoney(totals.balance, budget.currency)}</span>
                    </div>
                  </>
                )}
              </div>

              {error && <p className="mt-4 rounded-md bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
              {savedMsg && <p className="mt-4 text-sm text-teal-600">{savedMsg} ✓</p>}

              <div className="mt-5 space-y-2">
                <button onClick={() => handleSave({ status: budget.status, mode: 'final', after: 'detail' })} disabled={saving} className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold">
                  {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear presupuesto'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryBtn onClick={() => setShowPreview(true)} disabled={saving}>Vista previa</SecondaryBtn>
                  <SecondaryBtn onClick={() => handleSave({ status: budget.status, mode: 'final', after: 'download' })} disabled={saving}>
                    Crear + PDF
                  </SecondaryBtn>
                  <SecondaryBtn onClick={() => handleSave({ status: 'enviado', mode: 'final', after: 'share' })} disabled={saving}>
                    Crear + enviar
                  </SecondaryBtn>
                  <SecondaryBtn onClick={() => handleSave({ status: 'borrador', mode: 'draft', after: 'editar' })} disabled={saving}>
                    Guardar borrador
                  </SecondaryBtn>
                </div>
                <button onClick={handleCancel} disabled={saving} className="w-full rounded-md px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-rust-500">
                  Cancelar
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Barra inferior fija (móvil) */}
      <div className="fixed inset-x-0 bottom-16 z-20 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">Total</p>
          <p className="truncate font-mono text-base font-semibold text-brand-700">{formatMoney(totals.total, budget.currency)}</p>
        </div>
        <button
          onClick={() => handleSave({ status: budget.status, mode: 'final', after: 'detail' })}
          disabled={saving}
          className="btn-primary shrink-0 rounded-md px-5 py-2.5 text-sm font-semibold"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
        </button>
      </div>

      {showPreview && (
        <PreviewModal
          budget={previewBudget}
          items={items}
          client={clients.find((c) => c.id === budget.client_id) || null}
          profile={profile}
          totals={totals}
          onClose={() => setShowPreview(false)}
          actions={
            <button
              onClick={() => {
                setShowPreview(false)
                handleSave({ status: budget.status, mode: 'final', after: 'detail' })
              }}
              className="btn-primary rounded-md px-3.5 py-1.5 text-sm font-semibold"
            >
              {isEdit ? 'Guardar' : 'Crear presupuesto'}
            </button>
          }
        />
      )}
    </div>
  )
}

// Comparte el PDF por la API nativa o cae a descarga.
async function shareBudget(pdfData) {
  try {
    const blob = await generateBudgetPdfBlob(pdfData)
    const file = new File([blob], `${formatNumero(pdfData.budget.numero, pdfData.budget.issue_date)}.pdf`, { type: 'application/pdf' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Presupuesto', text: `Presupuesto de ${pdfData.profile?.business_name || ''}` })
    } else {
      await downloadBudgetPdf(pdfData)
    }
  } catch (err) {
    if (err?.name !== 'AbortError') await downloadBudgetPdf(pdfData)
  }
}

function isMissingColumn(err) {
  const m = `${err?.message || ''} ${err?.code || ''}`.toLowerCase()
  return m.includes('column') || err?.code === 'pgrst204' || err?.code === '42703'
}

const inputCls =
  'w-full rounded-md border border-line px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

function Labeled({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </label>
  )
}

function FieldError({ children }) {
  return <p className="mt-1.5 text-xs text-rust-500">{children}</p>
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-ink-soft">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-full border border-brand-500 bg-brand-500 px-3 py-1.5 text-xs font-medium text-white'
          : 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint'
      }
    >
      {children}
    </button>
  )
}

function SecondaryBtn({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-ink-faint hover:bg-ink/[0.02] disabled:opacity-50"
    >
      {children}
    </button>
  )
}
