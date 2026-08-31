import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import BotonGoogle from '../components/BotonGoogle'
import CampoPassword from '../components/CampoPassword'
import { useMensajeErrorAuth } from '../lib/erroresAuth'
import { anotarFallo, esperaRestante, formatoEspera, limpiarIntentos } from '../lib/limiteIntentos'
import { useSeo } from '../lib/seo'

export default function Login() {
  const { t } = useTranslation()
  useSeo({ title: t('seo.ingresarTitulo'), description: t('seo.ingresarDesc') })

  const { signIn } = useAuth()
  const navigate = useNavigate()
  const mensajeDeError = useMensajeErrorAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Milisegundos que faltan para poder volver a probar. Se recalcula solo
  // para que el cartel descuente en vez de quedar clavado en un número
  // viejo que ya venció.
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    setEspera(esperaRestante(form.email))
  }, [form.email])

  useEffect(() => {
    if (espera <= 0) return
    const id = setInterval(() => setEspera(esperaRestante(form.email)), 1000)
    return () => clearInterval(id)
  }, [espera, form.email])

  const avisarEspera = (ms) => {
    const { unidad, valor } = formatoEspera(ms)
    setError(
      unidad === 'segundos'
        ? t('auth.errores.esperaCorta', { segundos: valor })
        : t('auth.errores.demasiadosIntentos', { minutos: valor })
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // El freno se mira antes de salir a la red: no tiene sentido gastar un
    // intento contra Supabase si acá ya sabemos que está bloqueado.
    const bloqueo = esperaRestante(form.email)
    if (bloqueo > 0) {
      setEspera(bloqueo)
      avisarEspera(bloqueo)
      return
    }

    setLoading(true)
    try {
      await signIn(form)
      limpiarIntentos(form.email)
      navigate('/panel')
    } catch (err) {
      // Solo cuentan los fallos de contraseña. Que se caiga la red no
      // tiene por qué acercar a nadie al bloqueo.
      const esCredencial = `${err?.message || ''}`.toLowerCase().includes('invalid login credentials')
      const restante = esCredencial ? anotarFallo(form.email) : 0
      setEspera(restante)
      if (restante > 0) avisarEspera(restante)
      else setError(mensajeDeError(err.message))
    } finally {
      setLoading(false)
    }
  }

  const bloqueado = espera > 0

  return (
    <AuthLayout title={t('auth.loginTitulo')} subtitle={t('auth.loginSubtitulo')}>
      {/* Arriba del formulario a propósito: es el camino más corto y el
          que más gente usa. */}
      <BotonGoogle>{t('auth.conGoogle')}</BotonGoogle>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-faint">{t('auth.o')}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>

        <div className="flex justify-end">
          <Link to="/recuperar" className="text-sm text-ink-soft hover:text-brand-600 hover:underline">
            {t('auth.olvide')}
          </Link>
        </div>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || bloqueado}
          className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? t('auth.ingresando') : t('auth.ingresar')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t('auth.sinCuenta')}{' '}
        <Link to="/registro" className="font-medium text-brand-600 hover:underline">
          {t('auth.creaUnaGratis')}
        </Link>
      </p>
    </AuthLayout>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}
