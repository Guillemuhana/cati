import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { Field } from './Login'
import { useSeo } from '../lib/seo'

export default function RecuperarPassword() {
  const { t } = useTranslation()
  useSeo({ title: t('seo.recuperarTitulo'), description: t('seo.recuperarDesc') })

  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(email)
      setEnviado(true)
    } catch (err) {
      setError(t(claveErrorRecupero(err.message)))
    } finally {
      setLoading(false)
    }
  }

  // A propósito no decimos si el email existe o no: si lo dijéramos,
  // cualquiera podría usar esta pantalla para averiguar quién tiene cuenta.
  if (enviado) {
    return (
      <AuthLayout title={t('recuperar.listoTitulo')} subtitle={t('recuperar.listoSubtitulo')}>
        <div className="flex flex-col items-center text-center">
          <MailCheck size={40} className="text-brand-600" strokeWidth={1.5} />
          <p className="mt-4 text-sm text-ink-soft">
            {/* Trans y no una interpolación suelta: el email va en negrita
                en medio de la frase, y en inglés cae en otro lugar. */}
            <Trans
              i18nKey="recuperar.listoDetalle"
              values={{ email }}
              components={[<span key="0" className="font-medium text-ink" />]}
            />
          </p>
          <p className="mt-3 text-sm text-ink-faint">
            {t('recuperar.noLlego')}{' '}
            <button
              type="button"
              onClick={() => setEnviado(false)}
              className="font-medium text-brand-600 hover:underline"
            >
              {t('recuperar.otroEmail')}
            </button>
            .
          </p>
        </div>

        <Link
          to="/ingresar"
          className="mt-6 block rounded-md border border-line py-2.5 text-center text-sm font-medium text-ink hover:bg-paper"
        >
          {t('recuperar.volverIngresar')}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('recuperar.titulo')} subtitle={t('recuperar.subtitulo')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('auth.email')}>
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold"
        >
          {loading ? t('recuperar.enviando') : t('recuperar.enviar')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('recuperar.teAcordaste')}{' '}
        <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
          {t('recuperar.volverIngresar')}
        </Link>
      </p>

      {/* Quien entró con Google no tiene contraseña nuestra que recuperar. */}
      <p className="mt-3 text-center text-xs text-ink-faint">{t('recuperar.avisoGoogle')}</p>
    </AuthLayout>
  )
}

// Devuelve la clave del catálogo, no el texto: el mensaje lo arma la
// pantalla, que es la que sabe en qué idioma está.
export function claveErrorRecupero(message = '') {
  const m = `${message}`.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes'))
    return 'recuperar.errorLimite'
  if (m.includes('invalid') && m.includes('email')) return 'recuperar.errorEmail'
  return 'recuperar.errorGenerico'
}
