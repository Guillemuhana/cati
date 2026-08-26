import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Unlink2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import CampoPassword from '../components/CampoPassword'
import Spinner from '../components/Spinner'
import { Field } from './Login'
import { useSeo } from '../lib/seo'

const MINIMO = 6

export default function NuevaPassword() {
  useSeo({
    title: 'Elegir contraseña nueva',
    description: 'Elegí una contraseña nueva para tu cuenta de Numera.',
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
        setError(traducirErrorLink(fallo))
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
          setError(traducirErrorLink(err.message))
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
      setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`)
      return
    }
    if (form.password !== form.repetir) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      await updatePassword(form.password)
      // El link de recupero ya dejó la sesión abierta: no hace falta que
      // vuelva a escribir la contraseña que acaba de elegir.
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(traducirErrorLink(err.message))
      setLoading(false)
    }
  }

  if (estado === 'verificando') {
    return (
      <AuthLayout title="Un segundo" subtitle="Estamos revisando el link.">
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </AuthLayout>
    )
  }

  if (estado === 'invalido') {
    return (
      <AuthLayout
        title="Ese link ya no sirve"
        subtitle="Los links de recupero duran una hora y se usan una sola vez."
      >
        <div className="flex flex-col items-center text-center">
          <Unlink2 size={38} className="text-ink-faint" strokeWidth={1.5} />
          <p className="mt-4 text-sm text-ink-soft">
            {error || 'Pedí uno nuevo y volvé a abrirlo desde el mail.'}
          </p>
        </div>

        <Link
          to="/recuperar"
          className="btn-primary mt-6 block rounded-md py-2.5 text-center text-sm font-semibold"
        >
          Pedir un link nuevo
        </Link>
        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
            Volver a ingresar
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Elegí una contraseña nueva"
      subtitle="Con esta vas a entrar de ahora en más."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Contraseña nueva">
          <CampoPassword
            autoFocus
            minLength={MINIMO}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Repetila">
          <CampoPassword
            autoComplete="new-password"
            value={form.repetir}
            onChange={(e) => setForm({ ...form, repetir: e.target.value })}
          />
        </Field>

        <p className="text-xs text-ink-faint">Al menos {MINIMO} caracteres.</p>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold"
        >
          {loading ? 'Guardando...' : 'Guardar y entrar'}
        </button>
      </form>
    </AuthLayout>
  )
}

export function traducirErrorLink(message = '') {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('invalid') || m.includes('not found'))
    return 'El link venció o ya se usó. Pedí uno nuevo.'
  if (m.includes('should be at least') || m.includes('password should'))
    return `La contraseña tiene que tener al menos ${MINIMO} caracteres.`
  if (m.includes('different from the old') || m.includes('same as the old'))
    return 'Esa es la contraseña que ya tenías. Elegí otra.'
  if (m.includes('session') || m.includes('jwt'))
    return 'Se cortó la sesión del recupero. Pedí un link nuevo.'
  return message || 'No pudimos guardar la contraseña. Probá de nuevo.'
}
