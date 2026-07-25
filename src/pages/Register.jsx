import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { Field, traducirError } from './Login'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ businessName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signUp(form)
      if (data.session) {
        navigate('/panel')
      } else {
        setDone(true)
      }
    } catch (err) {
      setError(traducirError(err.message))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthLayout title="Revisá tu correo" subtitle="Te enviamos un enlace para confirmar tu cuenta.">
        <p className="text-center text-sm text-ink-soft">
          Una vez confirmada, ya podés{' '}
          <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
            ingresar
          </Link>
          .
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="Armá presupuestos prolijos en minutos.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre de tu negocio">
          <input
            type="text"
            required
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Ej: Estudio Martínez"
          />
        </Field>
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
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-md border border-line px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
        </Field>

        {error && <p className="text-sm text-rust-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full rounded-md py-2.5 text-sm font-semibold"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Ya tenés cuenta?{' '}
        <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
          Ingresá
        </Link>
      </p>
    </AuthLayout>
  )
}
