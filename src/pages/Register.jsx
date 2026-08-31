import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import BotonGoogle from '../components/BotonGoogle'
import CampoPassword from '../components/CampoPassword'
import { Field } from './Login'
import { useMensajeErrorAuth } from '../lib/erroresAuth'
import { getStoredReferral, clearStoredReferral } from '../lib/referral'
import { RUBRO_GROUPS } from '../lib/rubros'
import { useSeo } from '../lib/seo'

export default function Register() {
  const { t } = useTranslation()
  useSeo({ title: t('registro.seoTitulo'), description: t('registro.seoDesc') })

  const mensajeDeError = useMensajeErrorAuth()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ businessName: '', email: '', password: '', rubro: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  // Se leyó del ?ref= al entrar (ver lib/referral.js).
  const [referralCode] = useState(getStoredReferral)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signUp({ ...form, referralCode })
      clearStoredReferral()
      if (data.session) {
        navigate('/panel')
      } else {
        setDone(true)
      }
    } catch (err) {
      setError(mensajeDeError(err.message))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout title={t('registro.confirmaTitulo')} subtitle={t('registro.confirmaSubtitulo')}>
        <p className="text-center text-sm text-ink-soft">
          {t('registro.confirmaDetalle')}{' '}
          <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
            {t('registro.confirmaIngresar')}
          </Link>
          .
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('registro.titulo')} subtitle={t('registro.subtitulo')}>
      {referralCode && (
        <div className="mb-5 rounded-xl2 border border-teal-500/30 bg-teal-500/[0.07] px-4 py-3 text-center text-sm text-ink-soft">
          {t('registro.invitacion')}
        </div>
      )}

      {/* Con Google no hay que elegir contraseña ni confirmar el mail:
          la cuenta queda lista de una. El nombre del negocio y el rubro
          los pide después la bienvenida del panel. */}
      <BotonGoogle>{t('auth.crearConGoogle')}</BotonGoogle>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-faint">{t('auth.o')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('registro.nombreNegocio')}>
          <input
            type="text"
            required
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            placeholder={t('registro.nombreNegocioEjemplo')}
          />
        </Field>
        <Field label={t('registro.rubro')}>
          <select
            value={form.rubro}
            onChange={(e) => setForm({ ...form, rubro: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">{t('registro.rubroElegir')}</option>
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
          <p className="mt-1.5 text-xs text-ink-faint">{t('registro.rubroAyuda')}</p>
        </Field>
        <Field label={t('auth.email')}>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>
        <Field label={t('auth.password')}>
          <CampoPassword
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold"
        >
          {loading ? t('registro.creando') : t('auth.crearCuenta')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('registro.yaTenesCuenta')}{' '}
        <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
          {t('registro.ingresa')}
        </Link>
      </p>
    </AuthLayout>
  )
}
