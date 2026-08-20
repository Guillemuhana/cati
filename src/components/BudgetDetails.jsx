import { useRef } from 'react'

export const MAX_DETAILS = 8
const MAX_LABEL = 40
const MAX_VALUE = 200

// Datos sueltos del trabajo: «Fecha del evento», «Patente», «Superficie».
// Los nombres los sugiere el rubro del usuario, pero todos son opcionales
// y puede inventar los suyos. La tarjeta arranca vacía: el que no los usa
// no tiene que ignorar cuatro campos en cada presupuesto.
export default function BudgetDetails({ sugeridos = [], value = [], onChange }) {
  const details = Array.isArray(value) ? value : []
  const ultimoRef = useRef(null)

  const usados = new Set(details.map((d) => d.label))
  const disponibles = sugeridos.filter((s) => !usados.has(s))
  const lleno = details.length >= MAX_DETAILS

  const agregar = (label) => {
    if (lleno) return
    onChange([...details, { label, value: '' }])
    // El campo recién agregado se enfoca solo: si lo agregaste es para
    // escribir ahí.
    ultimoRef.current = details.length
  }

  const editar = (i, patch) =>
    onChange(details.map((d, j) => (j === i ? { ...d, ...patch } : d)))

  const quitar = (i) => onChange(details.filter((_, j) => j !== i))

  return (
    <div>
      {details.length > 0 && (
        <div className="mb-4 space-y-3">
          {details.map((d, i) => {
            // Los que salen de un chip llevan el nombre fijo; los que
            // agregó a mano lo tienen editable.
            const propio = !sugeridos.includes(d.label)
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
                  {propio ? (
                    <input
                      type="text"
                      value={d.label}
                      maxLength={MAX_LABEL}
                      placeholder="Nombre del dato"
                      onChange={(e) => editar(i, { label: e.target.value })}
                      className="w-full rounded-md border border-line px-3 py-2 text-sm font-medium transition focus:border-brand-500 focus:outline-none"
                    />
                  ) : (
                    <span className="flex items-center py-2 text-sm font-medium text-ink">{d.label}</span>
                  )}
                  <input
                    type="text"
                    value={d.value}
                    maxLength={MAX_VALUE}
                    autoFocus={ultimoRef.current === i}
                    placeholder="Ej: Sábado 14/03"
                    onChange={(e) => editar(i, { value: e.target.value })}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  aria-label={`Quitar ${d.label || 'dato'}`}
                  className="shrink-0 rounded-md px-2 py-2 text-sm text-ink-faint transition hover:text-rust-500"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {lleno ? (
        <p className="text-xs text-ink-faint">Llegaste a los {MAX_DETAILS} datos. Sacá uno para agregar otro.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {disponibles.map((s) => (
            <Chip key={s} onClick={() => agregar(s)}>
              + {s}
            </Chip>
          ))}
          <Chip onClick={() => agregar('')} destacado={disponibles.length === 0}>
            + Agregar otro dato
          </Chip>
        </div>
      )}

      {details.length === 0 && (
        <p className="mt-2 text-xs text-ink-faint">
          Opcional. Lo que cargues acá se imprime arriba del detalle, en el PDF y en el enlace del cliente.
        </p>
      )}
    </div>
  )
}

function Chip({ onClick, destacado, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        destacado
          ? 'rounded-full border border-dashed border-brand-500/50 px-3 py-1.5 text-xs font-medium text-brand-600 transition hover:bg-brand-500/[0.06]'
          : 'rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink'
      }
    >
      {children}
    </button>
  )
}

// Solo se guardan los que tienen nombre y contenido: un campo agregado
// y dejado vacío no ensucia el PDF.
export function cleanDetails(details) {
  return (Array.isArray(details) ? details : [])
    .map((d) => ({ label: (d.label || '').trim().slice(0, MAX_LABEL), value: (d.value || '').trim().slice(0, MAX_VALUE) }))
    .filter((d) => d.label && d.value)
    .slice(0, MAX_DETAILS)
}
