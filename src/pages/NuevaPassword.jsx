import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Unlink2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import CampoPassword from '../components/CampoPassword'
import Spinner from '../components/Spinner'
import { Field } from './Login'
import { useSeo } from '../lib/seo'

const MINIMO = 6

export default function NuevaPassword() {
  const { t } = useTranslation()
  useSeo({
    title: t('seo.nuevaPasswordTitulo'),
    description: t('seo.nuevaPasswordDesc'),
    noindex: true
  })

  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  // 'verificando' mientras se canjea el link, 'listo' cuando el link valía,
  // 'invalido' si venció, ya se usó, o se entró de casualidad a esta URL.
  const [estado, setEstado] = useState('verificando')
  const [form, setForm] = useState({ password: '', repetir: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let vivo = true

    // El link del mail trae el token en la URL. Una vez canjeado no sirve
    // más, pero mejor que no quede a la vista ni en el historial.
    const limpiarUrl = () => {
      window.history.replaceState({}, '', window.location.pathname)
    }

    const verificar = async () => {
      const query = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

      // Supabase avisa por acá cuando el link venció o ya se usó.
      const fallo = query.get('error_description') || hash.get('error_description')
      if (fallo) {
        if (!vivo) return
        setError(t(claveErrorLink(fallo), { minimo: MINIMO }))
        setEstado('invalido')
        return
      }

      // Las plantillas nuevas de Supabase mandan un token para canjear acá;
      // las viejas ya vienen con la sesión puesta en el # de la URL, y de eso
      // se encarga solo el cliente al arrancar.
      const tokenHash = query.get('token_hash')
      if (tokenHash) {
        const { error: err } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery'
        })
        if (!vivo) return
        if (err) {
          setError(t(claveErrorLink(err.message), { minimo: MINIMO }))
          setEstado('invalido')
          return
        }
        limpiarUrl()
        setEstado('listo')
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!vivo) return
      limpiarUrl()
      setEstado(data.session ? 'listo' : 'invalido')
    }

    verificar()
    return () => {
      vivo = false
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password.length < MINIMO) {
      setError(t('nuevaPassword.errorCorta', { minimo: MINIMO }))
      return
    }
    if (form.password !== form.repetir) {
      setError(t('nuevaPassword.errorNoCoinciden'))
      return
    }

    setLoading(true)
    try {
      await updatePassword(form.password)
      // El link de recupero ya dejó la sesión abierta: no hace falta que
      // vuelva a escribir la contraseña que acaba de elegir.
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(t(claveErrorLink(err.message), { minimo: MINIMO }))
      setLoading(false)
    }
  }

  if (estado === 'verificando') {
    return (
      <AuthLayout
        title={t('nuevaPassword.verificandoTitulo')}
        subtitle={t('nuevaPassword.verificandoSubtitulo')}
      >
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </AuthLayout>
    )
  }

  if (estado === 'invalido') {
    return (
      <AuthLayout
        title={t('nuevaPassword.invalidoTitulo')}
        subtitle={t('nuevaPassword.invalidoSubtitulo')}
      >
        <div className="flex flex-col items-center text-center">
          <Unlink2 size={38} className="text-ink-faint" strokeWidth={1.5} />
          <p className="mt-4 text-sm text-ink-soft">
            {error || t('nuevaPassword.invalidoDetalle')}
          </p>
        </div>

        <Link
          to="/recuperar"
          className="btn-primary mt-6 block rounded-md py-2.5 text-center text-sm font-semibold"
        >
          {t('nuevaPassword.pedirNuevo')}
        </Link>
        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
            {t('recuperar.volverIngresar')}
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('nuevaPassword.titulo')} subtitle={t('nuevaPassword.subtitulo')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('nuevaPassword.campoNueva')}>
          <CampoPassword
            autoFocus
            minLength={MINIMO}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label={t('nuevaPassword.campoRepetir')}>
          <CampoPassword
            autoComplete="new-password"
            value={form.repetir}
            onChange={(e) => setForm({ ...form, repetir: e.target.value })}
          />
        </Field>

        <p className="text-xs text-ink-faint">{t('nuevaPassword.minimo', { minimo: MINIMO })}</p>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold"
        >
          {loading ? t('comun.guardando') : t('nuevaPassword.guardarYEntrar')}
        </button>
      </form>
    </AuthLayout>
  )
}

// Devuelve la clave del catálogo: el texto lo arma la pantalla, que es
// la que sabe en qué idioma está.
export function claveErrorLink(message = '') {
  const m = `${message}`.toLowerCase()
  if (m.includes('expired') || m.includes('invalid') || m.includes('not found'))
    return 'nuevaPassword.errorVencido'
  if (m.includes('should be at least') || m.includes('password should'))
    return 'nuevaPassword.errorCorta'
  if (m.includes('different from the old') || m.includes('same as the old'))
    return 'nuevaPassword.errorMisma'
  if (m.includes('session') || m.includes('jwt')) return 'nuevaPassword.errorSesion'
  return 'nuevaPassword.errorGenerico'
}
