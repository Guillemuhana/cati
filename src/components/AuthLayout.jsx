export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 font-display text-xl font-semibold text-paper">
            C
          </span>
          <h1 className="font-display text-2xl font-medium text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        <div className="rounded-xl2 border border-line bg-surface p-6 shadow-soft sm:p-8">{children}</div>
      </div>
    </div>
  )
}
