import { STATUS } from '../lib/utils'

const COLOR_MAP = {
  ink: 'text-ink border-ink/30 bg-ink/[0.03]',
  brass: 'text-brass-600 border-brass-500/40 bg-brass-500/[0.08]',
  brand: 'text-brand-700 border-brand-500/40 bg-brand-500/[0.08]',
  rust: 'text-rust-500 border-rust-500/40 bg-rust-500/[0.08]'
}

export default function StatusBadge({ status, className = '' }) {
  const meta = STATUS[status] || STATUS.borrador
  return (
    <span
      className={`stamp inline-flex items-center rounded-md border-2 px-2.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider ${COLOR_MAP[meta.color]} ${className}`}
    >
      {meta.label}
    </span>
  )
}
