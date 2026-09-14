import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../hooks/usePlan'
import { supabase } from '../lib/supabaseClient'
import { CURRENCIES, missingColumnError } from '../lib/utils'
import { RUBRO_GROUPS, getRubro } from '../lib/rubros'
import { HOJA_EN_BLANCO, plantillaDe, plantillasPara } from '../lib/plantillas'
import { MotionConfig, motion } from 'motion/react'
import { CANALES } from '../lib/redes'
import RedIcon from '../components/RedIcon'
import MiFirma from '../components/MiFirma'

export default function Perfil() {
  const { t } = useTranslation()
  const { profile, user, updateProfile, refreshProfile } = useAuth()
  const { isPremium } = usePlan()
  const [form, setForm] = useState({
    business_name: profile?.business_name || '',
    firma_nombre: profile?.firma_nombre || '',
    firma_cargo: profile?.firma_cargo || '',
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
    plantilla_pdf: profile?.plantilla_pdf ?? null,
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

      // Si nunca eligió plantilla, ese campo ni se manda. Así, mientras
      // la migración 33 no esté corrida, Mi negocio se sigue guardando
      // igual que siempre en vez de fallar entero por una columna que
      // el usuario ni tocó. El que sí elige una recibe el aviso.
      const { plantilla_pdf, ...resto } = form
      const datos = plantilla_pdf === null ? resto : form

      await updateProfile({ ...datos, logo_url })
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
        <h1 className="font-display text-3xl font-medium text-ink">{t('perfil.titulo')}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t('perfil.bajada')}</p>
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
              {t('perfil.subirLogo')}
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            </label>
            <p className="text-xs text-ink-faint">{t('perfil.logoAyuda')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('perfil.nombreNegocio')}>
            <input
              type="text"
              required
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('perfil.tuNombre')}>
            <input
              type="text"
              placeholder={t('perfil.tuNombreEjemplo')}
              value={form.firma_nombre}
              onChange={(e) => setForm({ ...form, firma_nombre: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-ink-faint">{t('perfil.tuNombreAyuda')}</span>
          </Field>
          <Field label={t('perfil.tuCargo')}>
            <input
              type="text"
              placeholder={t('perfil.tuCargoEjemplo')}
              value={form.firma_cargo}
              onChange={(e) => setForm({ ...form, firma_cargo: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-ink-faint">{t('perfil.tuCargoAyuda')}</span>
          </Field>
          <Field label={t('perfil.emailContacto')}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('campos.telefono')}>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('campos.cuit')}>
            <input
              type="text"
              value={form.tax_id}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('campos.direccion')}>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('perfil.monedaDefecto')}>
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
          <p className="text-sm font-semibold text-ink">{t('perfil.contactoRedes')}</p>
          <p className="mt-0.5 text-xs text-ink-faint">{t('perfil.contactoRedesAyuda')}</p>
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
                {/* Cómo va a quedar, apenas lo escribe. Sin esto no hay
                    forma de saber que algo cargado no se muestra: el
                    canal simplemente no aparece en el enlace del cliente
                    y uno cree que la app no lo soporta. */}
                {form[canal.key]?.trim() ? (
                  canal.url(form[canal.key]) ? (
                    <span className="mt-1 block text-xs text-ink-faint">
                      {t('perfil.seVaAVer')}{' '}
                      <strong className="font-medium text-ink-soft">
                        {canal.texto(form[canal.key]) || form[canal.key]}
                      </strong>
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-rust-500">
                      {t('perfil.noSeEntiende')}{' '}
                      {canal.ayuda || t('perfil.probaCon', { ejemplo: canal.placeholder })}
                    </span>
                  )
                ) : (
                  canal.ayuda && <span className="mt-1 block text-xs text-ink-faint">{canal.ayuda}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <Field label={t('perfil.rubro')}>
          <select
            value={form.rubro}
            onChange={(e) => setForm({ ...form, rubro: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">{t('perfil.rubroSinEspecificar')}</option>
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
          <p className="mt-1.5 text-xs text-ink-faint">{t('perfil.rubroAyuda')}</p>
        </Field>

        <Field label={t('perfil.condicionesDefecto')}>
          <textarea
            rows={3}
            value={form.default_terms}
            onChange={(e) => setForm({ ...form, default_terms: e.target.value })}
            placeholder={sugerido.terms}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('perfil.condicionesPagoDefecto')}>
            <textarea
              rows={2}
              value={form.default_payment_terms}
              onChange={(e) => setForm({ ...form, default_payment_terms: e.target.value })}
              placeholder={sugerido.payment_terms || t('perfil.condicionesPagoEjemplo')}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label={t('perfil.formasPagoDefecto')}>
            <textarea
              rows={2}
              value={form.default_payment_methods}
              onChange={(e) => setForm({ ...form, default_payment_methods: e.target.value })}
              placeholder={sugerido.payment_methods || t('perfil.formasPagoEjemplo')}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>

        <Field label={t('perfil.datosBancarios')}>
          <input
            type="text"
            value={form.bank_alias}
            onChange={(e) => setForm({ ...form, bank_alias: e.target.value })}
            placeholder={t('perfil.datosBancariosEjemplo')}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        <Field label={t('perfil.terminos')}>
          <textarea
            rows={7}
            value={form.legal_terms}
            onChange={(e) => setForm({ ...form, legal_terms: e.target.value })}
            placeholder={t('perfil.terminosEjemplo')}
            className="w-full rounded-md border border-line px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-ink-faint">{t('perfil.terminosAyuda')}</p>
        </Field>

        {!isPremium && (
          <Link to="/premium" className="block rounded-xl2 border border-dashed border-brand-500/40 bg-brand-500/[0.04] p-4 text-center transition hover:bg-brand-500/[0.07]">
            <p className="text-sm font-semibold text-brand-700">{t('perfil.marcaPremiumTitulo')}</p>
            <p className="mt-1 text-xs text-ink-soft">{t('perfil.marcaPremiumDetalle')}</p>
          </Link>
        )}

        <div className={`rounded-xl2 border border-line bg-paper/50 p-4 ${isPremium ? '' : 'pointer-events-none opacity-50'}`}>
          <p className="mb-3 text-sm font-semibold text-ink">{t('perfil.marcaNumeracion')}</p>

          <div className="mb-5">
            <p className="mb-1 text-sm font-medium text-ink">{t('perfil.plantilla')}</p>
            <p className="mb-3 text-xs text-ink-faint">{t('perfil.plantillaAyuda')}</p>
            <SelectorPlantillas
              rubro={form.rubro}
              valor={form.plantilla_pdf}
              onChange={(pl) =>
                setForm({
                  ...form,
                  plantilla_pdf: pl.key,
                  // El color de la plantilla es una propuesta: queda
                  // escrito en el campo de abajo, a la vista, y el que
                  // quiere el suyo lo pisa ahí mismo.
                  brand_color: pl.color || form.brand_color
                })
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('perfil.colorMarca')}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-white"
                  aria-label={t('perfil.colorMarcaAria')}
                />
                <input
                  type="text"
                  value={form.brand_color}
                  onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                  className="w-full rounded-md border border-line px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </Field>
            <Field label={t('perfil.prefijoNumeracion')}>
              <input
                type="text"
                value={form.number_prefix}
                onChange={(e) => setForm({ ...form, number_prefix: e.target.value.toUpperCase() })}
                placeholder="PRES"
                maxLength={8}
                className="w-full rounded-md border border-line px-3 py-2 text-sm uppercase focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <Field label={t('perfil.marcaNumeraPdf')}>
              <label className="flex items-center gap-2 py-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={form.hide_branding}
                  onChange={(e) => setForm({ ...form, hide_branding: e.target.checked })}
                  className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-500"
                />
                {t('perfil.ocultarGenerado')}
              </label>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            {t('perfil.ejemploNumero')}{' '}
            <span className="font-mono text-ink-soft">{(form.number_prefix || 'PRES')}-2026-0001</span>
          </p>
        </div>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary rounded-md px-5 py-2.5 text-sm font-semibold"
          >
            {saving ? t('comun.guardando') : t('perfil.guardarCambios')}
          </button>
          {saved && <span className="text-sm text-brand-600">{t('comun.guardado')}</span>}
        </div>
      </form>

      {/* Va afuera del formulario a propósito: la firma se guarda sola,
          apenas se sube, y no espera al botón «Guardar cambios». */}
      <div className="mt-6">
        <MiFirma />
      </div>
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

// Las mismas que usan las páginas públicas: que toda la app se mueva
// igual importa más que cada pantalla tenga su gracia.
const aparecer = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }
}

const encadenado = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } }
}

/**
 * Elegir la hoja en la que salen el presupuesto, la factura y el recibo.
 *
 * Se muestran TODAS, con las del rubro adelante. No se esconde ninguna
 * a propósito: un gasista que prefiere la hoja limpia, o la de otro
 * oficio, la tiene que poder encontrar.
 *
 * Mientras no se elija nada, la que manda es la que le corresponde al
 * rubro (plantillaDe), así que la tarjeta marcada al entrar es esa y no
 * una en blanco: lo que se ve acá es lo que va a salir impreso.
 */
function SelectorPlantillas({ rubro, valor, onChange }) {
  const { t } = useTranslation()
  const { propias, resto } = plantillasPara(rubro)
  const elegida = plantillaDe({ rubro, plantilla_pdf: valor }).key

  const grupos = [
    { titulo: '', lista: [HOJA_EN_BLANCO] },
    { titulo: t('perfil.plantillaTuRubro'), lista: propias },
    { titulo: t('perfil.plantillaOtras'), lista: resto }
  ].filter((g) => g.lista.length > 0)

  return (
    // reducedMotion="user": el que pidió en su sistema que las cosas no
    // se muevan, no las ve moverse. Son veintiuna miniaturas entrando a
    // la vez; para alguien sensible al movimiento eso marea de verdad.
    <MotionConfig reducedMotion="user">
      <motion.div className="space-y-4" variants={encadenado} initial="hidden" animate="show">
        {grupos.map((g, i) => (
          <motion.div key={g.titulo || i} variants={encadenado}>
            {g.titulo && (
              <motion.p
                variants={aparecer}
                className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint"
              >
                {g.titulo}
              </motion.p>
            )}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {g.lista.map((pl) => (
                <TarjetaPlantilla
                  key={pl.key || 'blanco'}
                  plantilla={pl}
                  elegida={elegida === pl.key}
                  onClick={() => onChange(pl)}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </MotionConfig>
  )
}

/** Una hoja del selector, con su miniatura en proporción A4. */
function TarjetaPlantilla({ plantilla, elegida, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={elegida}
      title={plantilla.descripcion || plantilla.label}
      variants={aparecer}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={`overflow-hidden rounded-lg border-2 text-left transition-colors ${
        elegida ? 'border-brand-500 shadow-soft' : 'border-line hover:border-ink-faint'
      }`}
    >
      <div className="aspect-[1/1.414] w-full bg-white">
        {plantilla.fondo && (
          <img src={plantilla.fondo} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <p
        className={`truncate border-t px-2 py-1.5 text-[11px] font-medium ${
          elegida ? 'border-brand-500/40 bg-brand-500/[0.06] text-brand-700' : 'border-line text-ink-soft'
        }`}
      >
        {plantilla.label}
      </p>
    </motion.button>
  )
}
