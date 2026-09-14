import { useState } from 'react'

/**
 * Tarjeta de sección reutilizable para formularios y paneles.
 *
 * Con `plegable`, la sección arranca cerrada y se abre tocando el
 * título. Es para lo opcional: el formulario de presupuesto tenía ocho
 * secciones abiertas de par en par cuando el presupuesto de todos los
 * días es un cliente y dos ítems, así que había que pasar por delante
 * de seis que casi nunca se usan.
 *
 * `abierta` fuerza que arranque abierta aunque sea plegable. Se usa
 * cuando la sección YA tiene algo cargado: esconderle a alguien sus
 * propias notas al editar un presupuesto sería peor que el problema
 * que esto viene a resolver.
 */
export default function Card({
  title,
  desc,
  action,
  children,
  className = '',
  plegable = false,
  abierta = false
}) {
  const [open, setOpen] = useState(!plegable || abierta)

  const encabezado = (
    <div>
      {title && <h2 className="font-display text-base font-medium text-ink">{title}</h2>}
      {desc && <p className="mt-0.5 text-xs text-ink-soft">{desc}</p>}
    </div>
  )

  return (
    <section className={`rounded-xl2 border border-line bg-surface p-5 shadow-soft sm:p-6 ${className}`}>
      {(title || action) && (
        <div className={`flex items-start justify-between gap-3 ${open ? 'mb-4' : ''}`}>
          {plegable ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                width="16"
                height="16"
                aria-hidden="true"
                className={`mt-1 shrink-0 text-ink-faint transition ${open ? 'rotate-90' : ''}`}
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {encabezado}
            </button>
          ) : (
            encabezado
          )}
          {action}
        </div>
      )}
      {open && children}
    </section>
  )
}
