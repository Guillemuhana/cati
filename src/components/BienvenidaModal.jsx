import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Lo primero que ve alguien que entra por primera vez.
 *
 * No es un tour ni una lista de funciones: son los dos datos sin los
 * cuales el primer presupuesto sale mal (el nombre que va arriba del
 * documento y la moneda de los precios). Todo lo demás se completa
 * después, guiado desde «Primeros pasos» en el panel.
 *
 * Aparece solo si el negocio todavía no tiene nombre, así que se va solo
 * apenas se completa y nunca vuelve a molestar.
 */
const MONEDAS = [
  { v: 'ARS', t: 'Peso argentino ($)' },
  { v: 'USD', t: 'Dólar (US$)' },
  { v: 'EUR', t: 'Euro (€)' },
  { v: 'CLP', t: 'Peso chileno' },
  { v: 'UYU', t: 'Peso uruguayo' },
  { v: 'MXN', t: 'Peso mexicano' },
  { v: 'COP', t: 'Peso colombiano' }
]

export default function BienvenidaModal({ onListo, onSaltar }) {
  const { profile, updateProfile } = useAuth()
  const [paso, setPaso] = useState(1)
  const [nombre, setNombre] = useState(profile?.business_name || '')
  const [moneda, setMoneda] = useState(profile?.currency || 'ARS')
  const [telefono, setTelefono] = useState(profile?.phone || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async (campos) => {
    setGuardando(true)
    setError('')
    try {
      await updateProfile(campos)
      return true
    } catch (e) {
      setError(e?.message || 'No se pudo guardar. Probá de nuevo.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  const seguir = async () => {
    if (!nombre.trim()) {
      setError('Escribí el nombre para poder seguir.')
      return
    }
    if (await guardar({ business_name: nombre.trim(), currency: moneda })) setPaso(2)
  }

  const terminar = async () => {
    // El teléfono es opcional: si no lo puso, no lo pisamos.
    const campos = telefono.trim() ? { phone: telefono.trim() } : {}
    if (Object.keys(campos).length === 0 || (await guardar(campos))) onListo()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configurá tu negocio"
        className="w-full max-w-md rounded-t-xl2 border border-line bg-surface p-6 shadow-soft sm:rounded-xl2 sm:p-7"
      >
        <div className="flex items-center gap-1.5">
          {[1, 2].map((n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full transition ${n <= paso ? 'bg-brand-500' : 'bg-line'}`}
            />
          ))}
        </div>

        {paso === 1 ? (
          <>
            <h2 className="mt-5 font-display text-2xl font-medium text-ink">Bienvenido a Numera</h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              Dos datos y ya podés hacer tu primer presupuesto.
            </p>

            <label className="mt-6 block text-sm font-medium text-ink" htmlFor="bienvenida-nombre">
              ¿Cómo se llama tu negocio?
            </label>
            <input
              id="bienvenida-nombre"
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && seguir()}
              placeholder="Ej: Herrería San Martín"
              className="mt-1.5 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Es el nombre que van a leer tus clientes arriba del presupuesto.
            </p>

            <label className="mt-4 block text-sm font-medium text-ink" htmlFor="bienvenida-moneda">
              ¿En qué moneda cobrás?
            </label>
            <select
              id="bienvenida-moneda"
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500"
            >
              {MONEDAS.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.t}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <h2 className="mt-5 font-display text-2xl font-medium text-ink">
              ¿Con qué teléfono te contactan?
            </h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              Va al pie del presupuesto, para que el cliente te escriba sin buscarte.
            </p>

            <input
              autoFocus
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && terminar()}
              placeholder="11 5555-4444"
              inputMode="tel"
              className="mt-6 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Podés dejarlo vacío y cargarlo después en «Mi negocio».
            </p>
          </>
        )}

        {error && <p className="mt-3 text-xs text-rust-500">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={paso === 1 ? seguir : terminar}
            disabled={guardando}
            className="btn-primary flex-1 rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            {guardando ? 'Guardando…' : paso === 1 ? 'Seguir' : 'Empezar'}
          </button>
          <button
            onClick={paso === 1 ? onSaltar : terminar}
            disabled={guardando}
            className="text-sm font-medium text-ink-soft transition hover:text-ink"
          >
            {paso === 1 ? 'Ahora no' : 'Saltar'}
          </button>
        </div>
      </div>
    </div>
  )
}
