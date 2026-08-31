import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { PremiumGate } from '../components/Paywall'
import { formatMoney } from '../lib/utils'

const emptyProduct = { name: '', description: '', unit_price: 0 }

export default function Productos() {
  const { t } = useTranslation()
  return (
    <PremiumGate title={t('catalogo.gate')}>
      <ProductosInner />
    </PremiumGate>
  )
}

function ProductosInner() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)

  const load = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  const filtered = products.filter((p) => {
    const q = query.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
  })

  const handleSave = async (form) => {
    const payload = { name: form.name, description: form.description, unit_price: Number(form.unit_price) || 0 }
    if (editing === 'new') {
      await supabase.from('products').insert({ ...payload, user_id: user.id })
    } else {
      await supabase.from('products').update(payload).eq('id', editing.id)
    }
    setEditing(null)
    load()
  }

  const handleDelete = async (product) => {
    if (!window.confirm(t('catalogo.confirmarBorrado', { nombre: product.name }))) return
    await supabase.from('products').delete().eq('id', product.id)
    load()
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">{t('catalogo.titulo')}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t('catalogo.bajada')}</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">
          {t('catalogo.nuevo')}
        </button>
      </header>

      <input
        type="text"
        placeholder={t('catalogo.buscar')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:w-72"
      />

      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {loading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-soft">{t('catalogo.vacio')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                  {p.description && <p className="mt-0.5 truncate text-xs text-ink-soft">{p.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="font-mono text-sm text-ink">{formatMoney(p.unit_price, profile?.currency)}</span>
                  <button onClick={() => setEditing(p)} className="text-sm font-medium text-ink-soft hover:text-ink">
                    {t('comun.editar')}
                  </button>
                  <button onClick={() => handleDelete(p)} className="text-sm font-medium text-rust-500 hover:text-rust-500/80">
                    {t('comun.eliminar')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && <ProductModal product={editing === 'new' ? emptyProduct : editing} onClose={() => setEditing(null)} onSave={handleSave} />}
    </div>
  )
}

function ProductModal({ product, onClose, onSave }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(product)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-t-xl2 border border-line bg-surface p-6 shadow-soft sm:rounded-xl2">
        <h2 className="font-display text-xl font-medium text-ink">{product.name ? t('catalogo.editarProducto') : t('catalogo.nuevoProducto')}</h2>
        <div className="mt-4 space-y-3">
          <Field label={t('catalogo.nombre')}>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('catalogo.descripcion')}>
            <textarea
              rows={2}
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('catalogo.precioUnitario')}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-right font-mono text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 rounded-md py-2.5 text-sm font-semibold">
            {saving ? t('comun.guardando') : t('comun.guardar')}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-soft">
            {t('comun.cancelar')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}
