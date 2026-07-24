export default function StatCard({ label, value, hint, accent = false }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface px-5 py-4 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-medium ${accent ? 'text-brand-600' : 'text-ink'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}
