import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

const emptyClient = { name: '', email: '', phone: '', tax_id: '', address: '', notes: '' }

export default function Clientes() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | client object

  const load = async () => {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  const filtered = clients.filter((c) => {
    const q = query.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
  })

  const handleSave = async (form) => {
    if (editing === 'new') {
      await supabase.from('clients').insert({ ...form, user_id: user.id })
    } else {
      await supabase.from('clients').update(form).eq('id', editing.id)
    }
    setEditing(null)
    load()
  }

  const handleDelete = async (client) => {
    if (!window.confirm(`¿Eliminar a ${client.name}? Los presupuestos asociados quedarán sin cliente.`)) return
    await supabase.from('clients').delete().eq('id', client.id)
    load()
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Clientes</h1>
          <p className="mt-1 text-sm text-ink-soft">Tu cartera, lista para facturar el próximo trabajo.</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          + Nuevo cliente
        </button>
      </header>

      <input
        type="text"
        placeholder="Buscar cliente..."
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
          <p className="px-6 py-14 text-center text-sm text-ink-soft">Todavía no cargaste clientes.</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {[c.email, c.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button onClick={() => setEditing(c)} className="text-sm font-medium text-ink-soft hover:text-ink">
                    Editar
                  </button>
                  <button onClick={() => handleDelete(c)} className="text-sm font-medium text-rust-500 hover:text-rust-500/80">
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && <ClientModal client={editing === 'new' ? emptyClient : editing} onClose={() => setEditing(null)} onSave={handleSave} />}
    </div>
  )
}

function ClientModal({ client, onClose, onSave }) {
  const [form, setForm] = useState(client)
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
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-t-xl2 border border-line bg-surface p-6 shadow-soft sm:rounded-xl2"
      >
        <h2 className="font-display text-xl font-medium text-ink">{client.name ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        <div className="mt-4 space-y-3">
          <Field label="Nombre *">
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <Field label="Teléfono">
              <input
                type="text"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </Field>
          </div>
          <Field label="CUIT / ID fiscal">
            <input
              type="text"
              value={form.tax_id || ''}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Dirección">
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-md bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-soft">
            Cancelar
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
