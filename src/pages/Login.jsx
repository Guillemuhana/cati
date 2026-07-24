import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
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
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-500 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
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
