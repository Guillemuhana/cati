import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import ItemsTable, { newItem } from '../components/ItemsTable'
import ClientPicker from '../components/ClientPicker'
import Spinner from '../components/Spinner'
import { CURRENCIES, calculateTotals, formatMoney } from '../lib/utils'

const emptyBudget = {
  client_id: '',
  title: '',
  status: 'borrador',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  currency: 'ARS',
  discount_type: 'none',
  discount_value: 0,
  tax_rate: 0,
  notes: '',
  terms: 'Presupuesto válido por 15 días. Los precios no incluyen posibles ajustes por cambios de alcance.'
}

export default function PresupuestoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [clients, setClients] = useState([])
  const [budget, setBudget] = useState(emptyBudget)
  const [items, setItems] = useState([newItem(), newItem()])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }) => setClients(data || []))
  }, [user])

  useEffect(() => {
    if (!isEdit || !user) return
    let active = true
    ;(async () => {
      const [{ data: b }, { data: its }] = await Promise.all([
        supabase.from('budgets').select('*').eq('id', id).single(),
        supabase.from('budget_items').select('*').eq('budget_id', id).order('position')
      ])
      if (!active) return
      if (b) setBudget(b)
      if (its && its.length) setItems(its)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [id, isEdit, user])

  const totals = calculateTotals({
    items,
    discountType: budget.discount_type,
    discountValue: budget.discount_value,
    taxRate: budget.tax_rate
  })

  const handleCreateClient = async (clientData) => {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...clientData, user_id: user.id })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return null
    }
    setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }

  const handleSave = async (statusOverride) => {
    setError('')
    if (items.filter((it) => it.description.trim()).length === 0) {
      setError('Agregá al menos un ítem con descripción.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        client_id: budget.client_id || null,
        title: budget.title,
        status: statusOverride || budget.status,
        issue_date: budget.issue_date,
        due_date: budget.due_date || null,
        currency: budget.currency,
        discount_type: budget.discount_type,
        discount_value: Number(budget.discount_value) || 0,
        tax_rate: Number(budget.tax_rate) || 0,
        notes: budget.notes,
        terms: budget.terms,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total: totals.total,
        updated_at: new Date().toISOString()
      }

      let budgetId = id

      if (isEdit) {
        const { error: updateError } = await supabase.from('budgets').update(payload).eq('id', id)
        if (updateError) throw updateError
        await supabase.from('budget_items').delete().eq('budget_id', id)
      } else {
        const { count } = await supabase
          .from('budgets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
        payload.numero = (count || 0) + 1
        const { data, error: insertError } = await supabase.from('budgets').insert(payload).select().single()
        if (insertError) throw insertError
        budgetId = data.id
      }

      const itemsPayload = items
        .filter((it) => it.description.trim())
        .map((it, index) => ({
          budget_id: budgetId,
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          discount: Number(it.discount) || 0,
          position: index
        }))
      const { error: itemsError } = await supabase.from('budget_items').insert(itemsPayload)
      if (itemsError) throw itemsError

      navigate(`/presupuestos/${budgetId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="pb-28 lg:pb-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/presupuestos" className="text-sm text-ink-soft hover:text-ink">
            ← Presupuestos
          </Link>
          <h1 className="mt-1 font-display text-3xl font-medium text-ink">
            {isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'}
          </h1>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Datos generales">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Título (opcional)">
                <input
                  type="text"
                  placeholder="Ej: Rediseño de sitio web"
                  value={budget.title}
                  onChange={(e) => setBudget({ ...budget, title: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </Labeled>
              <Labeled label="Cliente">
                <ClientPicker
                  clients={clients}
                  value={budget.client_id}
                  onChange={(clientId) => setBudget({ ...budget, client_id: clientId })}
                  onCreateClient={handleCreateClient}
                />
              </Labeled>
              <Labeled label="Fecha de emisión">
                <input
                  type="date"
                  value={budget.issue_date}
                  onChange={(e) => setBudget({ ...budget, issue_date: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </Labeled>
              <Labeled label="Válido hasta">
                <input
                  type="date"
                  value={budget.due_date}
                  onChange={(e) => setBudget({ ...budget, due_date: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </Labeled>
              <Labeled label="Moneda">
                <select
                  value={budget.currency}
                  onChange={(e) => setBudget({ ...budget, currency: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Estado">
                <select
                  value={budget.status}
                  onChange={(e) => setBudget({ ...budget, status: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="borrador">Borrador</option>
                  <option value="enviado">Enviado</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="vencido">Vencido</option>
                </select>
              </Labeled>
            </div>
          </Section>

          <Section title="Ítems">
            <ItemsTable items={items} onChange={setItems} currency={budget.currency} />
          </Section>

          <Section title="Notas y condiciones">
            <div className="space-y-4">
              <Labeled label="Notas para el cliente">
                <textarea
                  rows={3}
                  value={budget.notes}
                  onChange={(e) => setBudget({ ...budget, notes: e.target.value })}
                  placeholder="Ej: Incluye 2 rondas de revisión."
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </Labeled>
              <Labeled label="Condiciones">
                <textarea
                  rows={3}
                  value={budget.terms}
                  onChange={(e) => setBudget({ ...budget, terms: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </Labeled>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-6">
            <Section title="Descuento e impuesto">
              <div className="space-y-3">
                <Labeled label="Tipo de descuento">
                  <select
                    value={budget.discount_type}
                    onChange={(e) => setBudget({ ...budget, discount_type: e.target.value })}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  >
                    <option value="none">Sin descuento</option>
                    <option value="percent">Porcentaje</option>
                    <option value="fixed">Monto fijo</option>
                  </select>
                </Labeled>
                {budget.discount_type !== 'none' && (
                  <Labeled label={budget.discount_type === 'percent' ? 'Descuento (%)' : 'Descuento (monto)'}>
                    <input
                      type="number"
                      min="0"
                      value={budget.discount_value}
                      onChange={(e) => setBudget({ ...budget, discount_value: e.target.value })}
                      className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none"
                    />
                  </Labeled>
                )}
                <Labeled label="Impuesto (%)">
                  <input
                    type="number"
                    min="0"
                    value={budget.tax_rate}
                    onChange={(e) => setBudget({ ...budget, tax_rate: e.target.value })}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none"
                  />
                </Labeled>
              </div>
            </Section>

            <Section title="Resumen">
              <div className="space-y-2 font-mono text-sm">
                <Row label="Subtotal" value={formatMoney(totals.subtotal, budget.currency)} />
                {totals.discountAmount > 0 && (
                  <Row label="Descuento" value={`-${formatMoney(totals.discountAmount, budget.currency)}`} />
                )}
                {totals.taxAmount > 0 && <Row label="Impuesto" value={formatMoney(totals.taxAmount, budget.currency)} />}
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                  <span className="font-sans text-sm font-semibold text-ink">Total</span>
                  <span className="text-base font-semibold text-brand-600">
                    {formatMoney(totals.total, budget.currency)}
                  </span>
                </div>
              </div>
            </Section>

            {error && <p className="text-sm text-rust-500">{error}</p>}

            <div className="hidden gap-2 lg:flex">
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="flex-1 rounded-md bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear presupuesto'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de acción fija en mobile */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="w-full rounded-md bg-brand-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear presupuesto'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-medium text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
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
