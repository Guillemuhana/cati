import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'
import { Field } from './Login'
import { useSeo } from '../lib/seo'

export default function RecuperarPassword() {
  useSeo({
    title: 'Recuperar contraseña',
    description: 'Te mandamos un mail para volver a entrar a tu cuenta de Numera.'
  })

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
      setError(traducirErrorRecupero(err.message))
    } finally {
      setLoading(false)
    }
  }

  // A propósito no decimos si el email existe o no: si lo dijéramos,
  // cualquiera podría usar esta pantalla para averiguar quién tiene cuenta.
  if (enviado) {
    return (
      <AuthLayout
        title="Revisá tu correo"
        subtitle="Si hay una cuenta con ese email, ya salió el link."
      >
        <div className="flex flex-col items-center text-center">
          <MailCheck size={40} className="text-brand-600" strokeWidth={1.5} />
          <p className="mt-4 text-sm text-ink-soft">
            Le mandamos un link a <span className="font-medium text-ink">{email}</span> para
            elegir una contraseña nueva. Vence en una hora.
          </p>
          <p className="mt-3 text-sm text-ink-faint">
            ¿No llegó? Fijate en el correo no deseado, o{' '}
            <button
              type="button"
              onClick={() => setEnviado(false)}
              className="font-medium text-brand-600 hover:underline"
            >
              probá con otro email
            </button>
            .
          </p>
        </div>

        <Link
          to="/ingresar"
          className="mt-6 block rounded-md border border-line py-2.5 text-center text-sm font-medium text-ink hover:bg-paper"
        >
          Volver a ingresar
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="¿Olvidaste tu contraseña?"
      subtitle="Poné tu email y te mandamos un link para elegir una nueva."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
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
          {loading ? 'Mandando...' : 'Mandarme el link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Te acordaste?{' '}
        <Link to="/ingresar" className="font-medium text-brand-600 hover:underline">
          Volver a ingresar
        </Link>
      </p>

      {/* Quien entró con Google no tiene contraseña nuestra que recuperar. */}
      <p className="mt-3 text-center text-xs text-ink-faint">
        Si creaste la cuenta con Google, entrá con el botón de Google: esa cuenta no
        tiene contraseña acá.
      </p>
    </AuthLayout>
  )
}

export function traducirErrorRecupero(message = '') {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes'))
    return 'Pediste varios links seguidos. Esperá un minuto y probá de nuevo.'
  if (m.includes('invalid') && m.includes('email')) return 'Ese email no parece válido.'
  return message || 'No pudimos mandar el mail. Probá de nuevo.'
}
