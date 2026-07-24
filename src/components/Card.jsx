// Tarjeta de sección reutilizable para formularios y paneles.
export default function Card({ title, desc, action, children, className = '' }) {
  return (
    <section className={`rounded-xl2 border border-line bg-surface p-5 shadow-soft sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-base font-medium text-ink">{title}</h2>}
            {desc && <p className="mt-0.5 text-xs text-ink-soft">{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
