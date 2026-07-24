import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { CURRENCIES } from '../lib/utils'

export default function Perfil() {
  const { profile, user, updateProfile, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    business_name: profile?.business_name || '',
    email: profile?.email || user?.email || '',
    phone: profile?.phone || '',
    tax_id: profile?.tax_id || '',
    address: profile?.address || '',
    currency: profile?.currency || 'ARS',
    default_terms: profile?.default_terms || ''
  })
  const [logoFile, setLogoFile] = useState(null)
  const [preview, setPreview] = useState(profile?.logo_url || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let logo_url = profile?.logo_url || null

      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `${user.id}/logo.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true, cacheControl: '3600' })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('logos').getPublicUrl(path)
        logo_url = `${data.publicUrl}?t=${Date.now()}`
      }

      await updateProfile({ ...form, logo_url })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium text-ink">Mi negocio</h1>
        <p className="mt-1 text-sm text-ink-soft">Estos datos aparecen en cada presupuesto que compartís.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl2 border border-line bg-surface p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-line bg-paper">
            {preview ? (
              <img src={preview} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="font-display text-xl text-ink-faint">
                {form.business_name?.[0]?.toUpperCase() || 'C'}
              </span>
            )}
          </div>
          <div>
            <label className="cursor-pointer text-sm font-medium text-brand-600 hover:underline">
              Subir logo
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            <p className="text-xs text-ink-faint">PNG o JPG, fondo transparente recomendado.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del negocio">
            <input
              type="text"
              required
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Email de contacto">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Teléfono">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="CUIT / ID fiscal">
            <input
              type="text"
              value={form.tax_id}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Dirección">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Moneda por defecto">
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Condiciones por defecto para nuevos presupuestos">
          <textarea
            rows={3}
            value={form.default_terms}
            onChange={(e) => setForm({ ...form, default_terms: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary rounded-md px-5 py-2.5 text-sm font-semibold"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          {saved && <span className="text-sm text-brand-600">Guardado ✓</span>}
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
