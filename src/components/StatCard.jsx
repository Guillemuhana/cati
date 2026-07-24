const TONES = {
  default: { value: 'text-ink', bar: 'bg-line', glow: '' },
  navy: { value: 'text-brand-700', bar: 'bg-brand-700', glow: 'from-brand-700/[0.06]' },
  blue: { value: 'text-brand-600', bar: 'bg-brand-500', glow: 'from-brand-500/[0.07]' },
  teal: { value: 'text-teal-600', bar: 'bg-teal-500', glow: 'from-teal-500/[0.08]' }
}

export default function StatCard({ label, value, hint, tone = 'default' }) {
  const t = TONES[tone] || TONES.default
  return (
    <div className="relative overflow-hidden rounded-xl2 border border-line bg-surface px-5 py-4 shadow-soft">
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      {t.glow && <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.glow} to-transparent`} />}
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
        <p className={`mt-1.5 font-display text-2xl font-medium ${t.value}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      </div>
    </div>
  )
}
