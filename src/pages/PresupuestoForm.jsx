import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
// shareBudget corre fuera de React: el idioma se lee de la instancia.
import i18n from '../i18n'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ItemsTable, { newItem } from '../components/ItemsTable'
import ClientPicker from '../components/ClientPicker'
import ProductPicker from '../components/ProductPicker'
import { usePlan } from '../hooks/usePlan'
import Card from '../components/Card'
import PreviewModal from '../components/PreviewModal'
import BudgetImages from '../components/BudgetImages'
import BudgetPdfPropio from '../components/BudgetPdfPropio'
import BudgetDetails, { cleanDetails } from '../components/BudgetDetails'
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
  getBudgetErrors,
  safeImages,
  safePdfUrl,
  storagePathFromUrl
} from '../lib/utils'
import { getRubro } from '../lib/rubros'

const emptyBudget = {
  client_id: '',
  title: '',
  reference: '',
  status: 'enviado', // un presupuesto nace listo para mandar: no hay borradores
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
  delivery_time: '',
  images: [],
  pdf_url: '',
  details: []
}

export default function PresupuestoForm() {
  const { t } = useTranslation()
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
  // Imágenes que tenía el presupuesto al abrirlo. Las que el usuario
  // saque se borran del Storage recién cuando guarda: si borráramos al
  // tocar la ✕ y después cancela, el presupuesto quedaría apuntando a
  // un archivo que ya no existe.
  const initialImagesRef = useRef([])
  const initialPdfRef = useRef('')

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
    const name = window.prompt(t('form.nombrePlantilla'))
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
      setError(isMissingColumn(err) ? t('form.errorPlantillas') : err.message)
      return
    }
    setSavedMsg(t('form.plantillaGuardada'))
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
      if (b) {
        setBudget({ ...emptyBudget, ...b })
        initialImagesRef.current = safeImages(b.images)
        initialPdfRef.current = safePdfUrl(b.pdf_url)
      }
      setItems(its && its.length ? its : [newItem()])
      prefilledRef.current = true
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [id, isEdit, user])

  // Prefill de defaults del negocio (solo presupuesto nuevo, una vez).
  // Orden de prioridad: lo que el usuario cargó en «Mi negocio» primero;
  // si lo dejó vacío, la sugerencia de su rubro; recién ahí el genérico.
  useEffect(() => {
    if (isEdit || prefilledRef.current || !profile) return
    prefilledRef.current = true
    const r = getRubro(profile.rubro)
    setBudget((b) => ({
      ...b,
      currency: profile.currency || b.currency,
      terms: profile.default_terms || r.terms || b.terms,
      payment_terms: profile.default_payment_terms || r.payment_terms || '',
      payment_methods: profile.default_payment_methods || r.payment_methods || '',
      due_date: b.due_date || addDays(b.issue_date, r.validity)
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
        setError(t('form.errorCampos'))
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
        images: Array.isArray(budget.images) ? budget.images : [],
        pdf_url: safePdfUrl(budget.pdf_url) || null,
        details: cleanDetails(budget.details),
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

      // Las imágenes que sacó ya no las referencia nadie: fuera del Storage.
      // (Si esto falla, el presupuesto igual quedó guardado bien.)
      const quitadas = initialImagesRef.current.filter((u) => !payload.images.includes(u))
      const paths = quitadas.map((u) => storagePathFromUrl(u, 'adjuntos')).filter(Boolean)
      // Y el PDF anterior, si lo cambió o lo sacó.
      if (initialPdfRef.current && initialPdfRef.current !== payload.pdf_url) {
        const viejo = storagePathFromUrl(initialPdfRef.current, 'adjuntos')
        if (viejo) paths.push(viejo)
      }
      if (paths.length) await supabase.storage.from('adjuntos').remove(paths)
      initialImagesRef.current = payload.images
      initialPdfRef.current = payload.pdf_url || ''

      dirtyRef.current = false

      // Acción posterior
      if (after === 'download' || after === 'share') {
        const pdfData = {
          budget: { ...payload, id: budgetId, numero, subtotal: totals.subtotal, discount_amount: totals.discountAmount, tax_amount: totals.taxAmount, total: totals.total, deposit: totals.deposit, balance: totals.balance },
          items: itemsPayload,
          client: clients.find((c) => c.id === budget.client_id) || null,
          profile
        }
        // El presupuesto ya quedó guardado: si falla el PDF avisamos, pero
        // no lo reportamos como si no se hubiera guardado.
        try {
          if (after === 'download') {
            await downloadBudgetPdf(pdfData)
          } else {
            await shareBudget(pdfData)
          }
        } catch (pdfErr) {
          setError(pdfErr?.message || t('form.errorPdf'))
        }
      }

      if (after === 'editar' && !isEdit) {
        navigate(`/presupuestos/${budgetId}/editar`, { replace: true })
        setSavedMsg('Guardado')
      } else if (after === 'editar') {
        setSavedMsg(t('form.cambiosGuardados'))
      } else {
        navigate(`/presupuestos/${budgetId}`)
      }
    } catch (err) {
      if (isMissingColumn(err)) {
        setError(t('form.errorColumnas'))
      } else {
        setError(err.message || t('campos.noSePudoGuardar'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (dirtyRef.current && !window.confirm(t('form.confirmarSalir'))) return
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
            {t('form.volver')}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-medium text-ink">
            {isEdit ? t('form.editar') : t('form.nuevo')}
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
              aria-label={t('form.usarPlantilla')}
            >
              <option value="">{t('form.usarPlantillaOpcion')}</option>
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
              {t('form.guardarPlantilla')}
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card title={t('form.datosGenerales')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label={t('form.tituloOpcional')}>
                <input
                  type="text"
                  placeholder={t('form.tituloEjemplo')}
                  value={budget.title}
                  onChange={(e) => patchBudget({ title: e.target.value })}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label={t('form.referencia')}>
                <input
                  type="text"
                  placeholder={t('form.referenciaEjemplo')}
                  value={budget.reference}
                  onChange={(e) => patchBudget({ reference: e.target.value })}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label={t('form.fechaEmision')}>
                <input
                  type="date"
                  value={budget.issue_date}
                  onChange={(e) => patchBudget({ issue_date: e.target.value })}
                  className={inputCls}
                />
              </Labeled>
              <Labeled label={t('form.validoHasta')} error={errors.due_date}>
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
                      {t('form.dias', { count: d })}
                    </Chip>
                  ))}
                </div>
              </Labeled>
              <Labeled label={t('form.moneda')}>
                <select value={budget.currency} onChange={(e) => patchBudget({ currency: e.target.value })} className={inputCls}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Labeled>
              <Labeled label={t('form.estado')}>
                <select value={budget.status} onChange={(e) => patchBudget({ status: e.target.value })} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(STATUS[s].label)}
                    </option>
                  ))}
                </select>
              </Labeled>
            </div>
          </Card>

          <Card title={t('form.cliente')} desc={t('form.clienteDesc')}>
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

          <Card title={t('form.datosTrabajo')} desc={t('form.datosTrabajoDesc')}>
            <BudgetDetails
              sugeridos={getRubro(profile?.rubro).fields}
              value={budget.details}
              onChange={(details) => patchBudget({ details })}
            />
          </Card>

          <Card
            title={t('form.productos')}
            action={isPremium ? <ProductPicker products={products} currency={budget.currency} onPick={pickProduct} /> : null}
          >
            <ItemsTable
              items={items}
              onChange={handleItems}
              currency={budget.currency}
              placeholder={getRubro(profile?.rubro).itemPlaceholder}
            />
            {errors.items && <FieldError>{errors.items}</FieldError>}
          </Card>

          <Card
            title={t('form.pdfPropio')}
            desc={
              getRubro(profile?.rubro).pdfPropio ||
              t('form.pdfPropioDesc')
            }
          >
            <BudgetPdfPropio
              userId={user.id}
              value={budget.pdf_url}
              onChange={(pdf_url) => patchBudget({ pdf_url })}
            />
          </Card>

          <Card title={t('form.imagenes')} desc={t('form.imagenesDesc')}>
            <BudgetImages
              userId={user.id}
              value={budget.images}
              onChange={(images) => patchBudget({ images })}
            />
          </Card>

          <Card title={t('form.descuentosImpuestos')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label={t('form.tipoDescuento')}>
                <select
                  value={budget.discount_type}
                  onChange={(e) => patchBudget({ discount_type: e.target.value })}
                  className={inputCls}
                >
                  <option value="none">{t('form.sinDescuento')}</option>
                  <option value="percent">{t('form.porcentaje')}</option>
                  <option value="fixed">{t('form.montoFijo')}</option>
                </select>
              </Labeled>
              {budget.discount_type !== 'none' && (
                <Labeled
                  label={t(budget.discount_type === 'percent' ? 'form.descuentoPct' : 'form.descuentoMonto')}
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
                <span className="mb-1.5 block text-sm font-medium text-ink">{t('form.ivaImpuesto')}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* `preset` y no `t`: `t` ya es la función de traducción. */}
                  {TAX_PRESETS.map((preset) => (
                    <Chip
                      key={preset.label}
                      active={Number(budget.tax_rate) === preset.value}
                      onClick={() => patchBudget({ tax_rate: preset.value })}
                    >
                      {t(preset.label)}
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
                      aria-label={t('form.impuestoPersonalizado')}
                    />
                    <span className="text-sm text-ink-soft">{t('form.personalizado')}</span>
                  </div>
                </div>
              </div>
              <Labeled label={t('form.anticipo')}>
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

          <Card title={t('form.notasCondiciones')}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Labeled label={t('form.notasCliente')}>
                  <textarea
                    rows={3}
                    value={budget.notes}
                    onChange={(e) => patchBudget({ notes: e.target.value })}
                    placeholder={t('form.notasEjemplo')}
                    className={inputCls}
                  />
                </Labeled>
                <Labeled label={t('form.condiciones')}>
                  <textarea rows={3} value={budget.terms} onChange={(e) => patchBudget({ terms: e.target.value })} className={inputCls} />
                </Labeled>
                <Labeled label={t('form.condicionesPago')}>
                  <textarea
                    rows={2}
                    value={budget.payment_terms}
                    onChange={(e) => patchBudget({ payment_terms: e.target.value })}
                    placeholder={t('perfil.condicionesPagoEjemplo')}
                    className={inputCls}
                  />
                </Labeled>
                <Labeled label={t('form.formasPago')}>
                  <textarea
                    rows={2}
                    value={budget.payment_methods}
                    onChange={(e) => patchBudget({ payment_methods: e.target.value })}
                    placeholder={t('perfil.formasPagoEjemplo')}
                    className={inputCls}
                  />
                </Labeled>
                <Labeled label={t('form.plazoEntrega')}>
                  <input
                    type="text"
                    value={budget.delivery_time}
                    onChange={(e) => patchBudget({ delivery_time: e.target.value })}
                    placeholder={t('form.plazoEjemplo')}
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
            <Card title={t('form.resumen')}>
              <div className="space-y-2 font-mono text-sm">
                <Row label={t('form.subtotal')} value={formatMoney(totals.subtotal, budget.currency)} />
                {totals.discountAmount > 0 && (
                  <Row label={t('form.descuento')} value={`-${formatMoney(totals.discountAmount, budget.currency)}`} />
                )}
                {totals.taxAmount > 0 && <Row label={`Impuesto (${budget.tax_rate}%)`} value={formatMoney(totals.taxAmount, budget.currency)} />}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-brand-500/[0.06] px-3 py-2">
                  <span className="font-sans text-sm font-semibold text-ink">{t('form.total')}</span>
                  <span className="font-sans text-xl font-semibold text-brand-700">{formatMoney(totals.total, budget.currency)}</span>
                </div>
                {totals.deposit > 0 && (
                  <>
                    <Row label={t('form.anticipoResumen')} value={`-${formatMoney(totals.deposit, budget.currency)}`} />
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <span className="font-sans text-sm font-semibold text-ink">{t('form.saldoPendiente')}</span>
                      <span className="font-semibold text-ink">{formatMoney(totals.balance, budget.currency)}</span>
                    </div>
                  </>
                )}
              </div>

              {error && <p className="mt-4 rounded-md bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}
              {savedMsg && <p className="mt-4 text-sm text-teal-600">{savedMsg} ✓</p>}

              <div className="mt-5 space-y-2">
                <button onClick={() => handleSave({ status: budget.status, mode: 'final', after: 'detail' })} disabled={saving} className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold">
                  {saving ? t('comun.guardando') : isEdit ? t('form.guardarCambios') : t('form.crearPresupuesto')}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryBtn onClick={() => setShowPreview(true)} disabled={saving}>
                    {t('form.vistaPrevia')}
                  </SecondaryBtn>
                  <SecondaryBtn onClick={() => handleSave({ status: budget.status, mode: 'final', after: 'download' })} disabled={saving}>
                    {t('form.crearPdf')}
                  </SecondaryBtn>
                  <SecondaryBtn onClick={() => handleSave({ status: 'enviado', mode: 'final', after: 'share' })} disabled={saving}>
                    {t('form.crearEnviar')}
                  </SecondaryBtn>
                  <SecondaryBtn onClick={() => handleSave({ status: budget.status, mode: 'draft', after: 'editar' })} disabled={saving}>
                    {t('form.guardarSeguir')}
                  </SecondaryBtn>
                </div>
                <button onClick={handleCancel} disabled={saving} className="w-full rounded-md px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-rust-500">
                  {t('comun.cancelar')}
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Barra inferior fija (móvil) */}
      <div className="fixed inset-x-0 bottom-16 z-20 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">{t('form.total')}</p>
          <p className="truncate font-mono text-base font-semibold text-brand-700">{formatMoney(totals.total, budget.currency)}</p>
        </div>
        <button
          onClick={() => handleSave({ status: budget.status, mode: 'final', after: 'detail' })}
          disabled={saving}
          className="btn-primary shrink-0 rounded-md px-5 py-2.5 text-sm font-semibold"
        >
          {saving ? t('comun.guardando') : isEdit ? t('comun.guardar') : t('form.crear')}
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
              {isEdit ? t('comun.guardar') : t('form.crearPresupuesto')}
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
      await navigator.share({
        files: [file],
        title: i18n.t('form.compartirTitulo'),
        text: i18n.t('form.compartirTexto', { negocio: pdfData.profile?.business_name || '' })
      })
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

// Sin `whitespace-nowrap` «Guardar y seguir» se parte en dos líneas y deja
// esa fila más alta que la de arriba: la botonera queda torcida.
function SecondaryBtn({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="whitespace-nowrap rounded-md border border-line px-2 py-2 text-[13px] font-medium text-ink transition hover:border-ink-faint hover:bg-ink/[0.02] disabled:opacity-50"
    >
      {children}
    </button>
  )
}
