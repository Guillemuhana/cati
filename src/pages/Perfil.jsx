import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../hooks/usePlan'
import { supabase } from '../lib/supabaseClient'
import { CURRENCIES, missingColumnError } from '../lib/utils'
import { RUBRO_GROUPS, getRubro } from '../lib/rubros'
import { CANALES } from '../lib/redes'
import RedIcon from '../components/RedIcon'

export default function Perfil() {
  const { profile, user, updateProfile, refreshProfile } = useAuth()
  const { isPremium } = usePlan()
  const [form, setForm] = useState({
    business_name: profile?.business_name || '',
    email: profile?.email || user?.email || '',
    phone: profile?.phone || '',
    tax_id: profile?.tax_id || '',
    address: profile?.address || '',
    currency: profile?.currency || 'ARS',
    rubro: profile?.rubro || '',
    website: profile?.website || '',
    whatsapp: profile?.whatsapp || '',
    instagram: profile?.instagram || '',
    facebook: profile?.facebook || '',
    tiktok: profile?.tiktok || '',
    youtube: profile?.youtube || '',
    x: profile?.x || '',
    default_terms: profile?.default_terms || '',
    default_payment_terms: profile?.default_payment_terms || '',
    default_payment_methods: profile?.default_payment_methods || '',
    legal_terms: profile?.legal_terms || '',
    bank_alias: profile?.bank_alias || '',
    brand_color: profile?.brand_color || '#1B3B6F',
    number_prefix: profile?.number_prefix || 'PRES',
    hide_branding: profile?.hide_branding || false
  })
  const [logoFile, setLogoFile] = useState(null)
  const [preview, setPreview] = useState(profile?.logo_url || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Textos que se van a usar si estos campos quedan vacíos.
  const sugerido = getRubro(form.rubro)

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
      setError(missingColumnError(err) || err.message)
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

        <div className="rounded-xl2 border border-line bg-paper/50 p-4">
          <p className="text-sm font-semibold text-ink">Contacto y redes</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Lo que cargues acá aparece en el PDF y en el enlace que ve el cliente, con su ícono y a un toque desde el
            celular. Todo opcional: lo que dejes vacío no se muestra.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CANALES.map((canal) => (
              <label key={canal.key} className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
                  <RedIcon canal={canal} color={canal.color} />
                  {canal.label}
                </span>
                <input
                  type="text"
                  value={form[canal.key]}
                  onChange={(e) => setForm({ ...form, [canal.key]: e.target.value })}
                  placeholder={canal.placeholder}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                {canal.ayuda && <span className="mt-1 block text-xs text-ink-faint">{canal.ayuda}</span>}
              </label>
            ))}
          </div>
        </div>

        <Field label="Rubro">
          <select
            value={form.rubro}
            onChange={(e) => setForm({ ...form, rubro: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Sin especificar</option>
            {RUBRO_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.rubros.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-faint">
            Solo se usa para sugerirte los textos de abajo cuando los dejás vacíos. No cambia nada de lo que ya cargaste.
          </p>
        </Field>

        <Field label="Condiciones por defecto para nuevos presupuestos">
          <textarea
            rows={3}
            value={form.default_terms}
            onChange={(e) => setForm({ ...form, default_terms: e.target.value })}
            placeholder={sugerido.terms}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Condiciones de pago por defecto">
            <textarea
              rows={2}
              value={form.default_payment_terms}
              onChange={(e) => setForm({ ...form, default_payment_terms: e.target.value })}
              placeholder={sugerido.payment_terms || 'Ej: 50% al aprobar, 50% contra entrega.'}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Formas de pago por defecto">
            <textarea
              rows={2}
              value={form.default_payment_methods}
              onChange={(e) => setForm({ ...form, default_payment_methods: e.target.value })}
              placeholder={sugerido.payment_methods || 'Ej: Transferencia, efectivo, Mercado Pago.'}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>

        <Field label="Datos bancarios / alias (aparecen en el PDF)">
          <input
            type="text"
            value={form.bank_alias}
            onChange={(e) => setForm({ ...form, bank_alias: e.target.value })}
            placeholder="Ej: alias mi.negocio.mp · CBU 000..."
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        <Field label="Términos y condiciones (opcional)">
          <textarea
            rows={7}
            value={form.legal_terms}
            onChange={(e) => setForm({ ...form, legal_terms: e.target.value })}
            placeholder={'Ej: La garantía cubre 6 meses por defectos de fabricación.\nLas cancelaciones con menos de 48 hs de aviso no reintegran la seña.\nLos plazos de entrega pueden variar por demoras del proveedor.'}
            className="w-full rounded-md border border-line px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-ink-faint">
            Texto legal de tu negocio (garantía, cancelaciones, letra chica). Se imprime al final del PDF y del enlace
            público de todos tus documentos. Si lo dejás vacío, no aparece nada.
          </p>
        </Field>

        {!isPremium && (
          <Link to="/premium" className="block rounded-xl2 border border-dashed border-brand-500/40 bg-brand-500/[0.04] p-4 text-center transition hover:bg-brand-500/[0.07]">
            <p className="text-sm font-semibold text-brand-700">🔒 Marca y numeración personalizada</p>
            <p className="mt-1 text-xs text-ink-soft">Color propio, prefijo de numeración y ocultar «Generado con Numera». Función premium.</p>
          </Link>
        )}

        <div className={`rounded-xl2 border border-line bg-paper/50 p-4 ${isPremium ? '' : 'pointer-events-none opacity-50'}`}>
          <p className="mb-3 text-sm font-semibold text-ink">Marca y numeración</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Color de marca (PDF)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-white"
                  aria-label="Color de marca"
                />
                <input
                  type="text"
                  value={form.brand_color}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </Field>
            <Field label="Prefijo de numeración">
              <input
                type="text"
                value={form.number_prefix}
                onChange={(e) => setForm({ ...form, number_prefix: e.target.value.toUpperCase() })}
                placeholder="PRES"
                maxLength={8}
                className="w-full rounded-md border border-line px-3 py-2 text-sm uppercase focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <Field label="Marca de Numera en el PDF">
              <label className="flex items-center gap-2 py-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={form.hide_branding}
                  onChange={(e) => setForm({ ...form, hide_branding: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500"
                />
                Ocultar «Generado con Numera»
              </label>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Ejemplo de número: <span className="font-mono text-ink-soft">{(form.number_prefix || 'PRES')}-2026-0001</span>
          </p>
        </div>

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
