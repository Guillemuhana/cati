import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { missingColumnError } from '../lib/utils'

const emptyClient = { name: '', email: '', phone: '', tax_id: '', address: '', notes: '', logo_url: '' }

export default function Clientes() {
  const { t } = useTranslation()
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
    const { error } =
      editing === 'new'
        ? await supabase.from('clients').insert({ ...form, user_id: user.id })
        : await supabase.from('clients').update(form).eq('id', editing.id)
    if (error) return error
    setEditing(null)
    load()
    return null
  }

  const handleDelete = async (client) => {
    if (!window.confirm(t('clientes.confirmarBorrado', { nombre: client.name }))) return
    await supabase.from('clients').delete().eq('id', client.id)
    load()
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">{t('clientes.titulo')}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t('clientes.bajada')}</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          {t('clientes.nuevo')}
        </button>
      </header>

      <input
        type="text"
        placeholder={t('clientes.buscar')}
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
          <p className="px-6 py-14 text-center text-sm text-ink-soft">{t('clientes.vacio')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <ClientAvatar client={c} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {[c.email, c.phone].filter(Boolean).join(' · ') || t('clientes.sinContacto')}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button onClick={() => setEditing(c)} className="text-sm font-medium text-ink-soft hover:text-ink">
                    {t('comun.editar')}
                  </button>
                  <button onClick={() => handleDelete(c)} className="text-sm font-medium text-rust-500 hover:text-rust-500/80">
                    {t('comun.eliminar')}
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

// Iniciales del cliente cuando todavía no subió logo.
function ClientAvatar({ client, size = 'h-10 w-10' }) {
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-paper`}>
      {client.logo_url ? (
        <img src={client.logo_url} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="font-display text-sm text-ink-faint">{client.name?.[0]?.toUpperCase() || 'C'}</span>
      )}
    </div>
  )
}

function ClientModal({ client, onClose, onSave }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [form, setForm] = useState(client)
  const [logoFile, setLogoFile] = useState(null)
  const [preview, setPreview] = useState(client.logo_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    setLogoFile(null)
    setPreview('')
    setForm((f) => ({ ...f, logo_url: '' }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let logo_url = form.logo_url || null

      if (logoFile) {
        // Mismo bucket que el logo del negocio: la primera carpeta tiene
        // que ser el id del usuario para pasar las policies de storage.
        const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase()
        const path = `${user.id}/clientes/${client.id || crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true, cacheControl: '3600' })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('logos').getPublicUrl(path)
        logo_url = `${data.publicUrl}?t=${Date.now()}`
      }

      const err = await onSave({ ...form, logo_url })
      if (err) throw err
    } catch (err) {
      setError(missingColumnError(err) || err?.message || t('campos.noSePudoGuardar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-t-xl2 border border-line bg-surface p-6 shadow-soft sm:rounded-xl2"
      >
        <h2 className="font-display text-xl font-medium text-ink">{client.name ? t('clientes.editarCliente') : t('clientes.nuevoCliente')}</h2>

        <div className="mt-4 flex items-center gap-4">
          <ClientAvatar client={{ ...form, logo_url: preview }} size="h-14 w-14" />
          <div>
            <label className="cursor-pointer text-sm font-medium text-brand-600 hover:underline">
              {preview ? t('clientes.cambiarLogo') : t('clientes.subirLogo')}
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            {preview && (
              <button type="button" onClick={removeLogo} className="ml-3 text-sm font-medium text-ink-soft hover:text-rust-500">
                {t('clientes.quitar')}
              </button>
            )}
            <p className="text-xs text-ink-faint">{t('clientes.logoAyuda')}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Field label={t('campos.nombre')}>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('campos.email')}>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <Field label={t('campos.telefono')}>
              <input
                type="text"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </Field>
          </div>
          <Field label={t('campos.cuit')}>
            <input
              type="text"
              value={form.tax_id || ''}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('campos.direccion')}>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>
        {error && <p className="mt-4 rounded-md bg-rust-500/10 px-3 py-2 text-sm text-rust-500">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-md bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
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
