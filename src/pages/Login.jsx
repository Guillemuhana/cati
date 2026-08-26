import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import BotonGoogle from '../components/BotonGoogle'
import { useSeo } from '../lib/seo'

export default function Login() {
  useSeo({
    title: 'Ingresar',
    description: 'Entrá a tu cuenta de Numera para ver y armar tus presupuestos.'
  })

  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(form)
      navigate('/panel')
    } catch (err) {
      setError(traducirError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Ingresá para seguir armando tus presupuestos."
    >
      {/* Arriba del formulario a propósito: es el camino más corto y el
          que más gente usa. */}
      <BotonGoogle>Ingresar con Google</BotonGoogle>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-faint">o</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>
        <Field label="Contraseña">
          <div className="relative">
            <input
              type={verPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-md border border-line py-2.5 pl-3 pr-11 text-sm focus:border-brand-500 focus:outline-none"
            />
            {/* El ojo sirve para chequear lo que uno escribió, así que
                arranca siempre tapado y no se acuerda de nada. */}
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint hover:text-ink-soft focus:outline-none"
            >
              {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-medium text-brand-600 hover:underline">
          Creá una gratis
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

export function traducirError(message = '') {
  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (message.includes('User already registered')) return 'Ya existe una cuenta con ese email.'
  if (message.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  return message || 'Ocurrió un error. Probá de nuevo.'
}
