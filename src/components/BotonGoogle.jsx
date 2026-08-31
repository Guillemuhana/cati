import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

/**
 * Entrar o registrarse con Google.
 *
 * Es el mismo botón en las dos pantallas: para Google no existe la
 * diferencia entre «crear cuenta» e «ingresar». Si es la primera vez, la
 * cuenta se crea sola; si ya existe, entra. Por eso el texto dice
 * «Continuar» y no una cosa ni la otra.
 *
 * El logo va dibujado acá, con los colores oficiales, porque las reglas
 * de marca de Google piden ese ícono y no otro.
 */
export default function BotonGoogle({ children }) {
  const { t } = useTranslation()
  const { signInWithGoogle } = useAuth()
  const [yendo, setYendo] = useState(false)
  const [error, setError] = useState('')

  const entrar = async () => {
    setError('')
    setYendo(true)
    try {
      await signInWithGoogle()
      // Si sale bien, el navegador se va a Google: esta pantalla ya no
      // existe. Por eso `yendo` no se apaga en el camino feliz.
    } catch (e) {
      const msg = `${e?.message || ''}`.toLowerCase()
      setError(
        msg.includes('provider') || msg.includes('not enabled')
          ? t('auth.googleNoHabilitado')
          : e?.message || t('auth.googleNoAbre')
      )
      setYendo(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={entrar}
        disabled={yendo}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink-faint hover:bg-paper disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
          />
          <path
            fill="#34A853"
            d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
          />
          <path
            fill="#FBBC05"
            d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
          />
          <path
            fill="#EA4335"
            d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
          />
        </svg>
        {yendo ? t('auth.abriendoGoogle') : children || t('auth.continuarGoogle')}
      </button>
      {error && <p className="mt-2 text-center text-sm text-rust-500">{error}</p>}
    </>
  )
}
