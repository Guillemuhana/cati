import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      {/* Degradados decorativos con los colores del logo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute top-32 right-[-6rem] h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-4rem] h-64 w-64 rounded-full bg-brand-700/[0.06] blur-3xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src="/cati-icon.svg" alt="Cati" className="h-8 w-8" />
          <span className="font-display text-xl font-medium text-ink">Cati</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/ingresar" className="text-sm font-medium text-ink-soft hover:text-ink">
            Ingresar
          </Link>
          <Link
            to="/registro"
            className="rounded-md bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:from-brand-700 hover:to-brand-600"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="stamp mb-6 inline-flex items-center rounded-md border-2 border-brand-500/40 bg-brand-500/[0.08] px-3 py-1 font-display text-xs font-semibold uppercase tracking-wider text-brand-700">
          Presupuestos, sin vueltas
        </span>
        <h1 className="font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
          Armá presupuestos prolijos y compartilos en PDF en minutos
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-soft">
          Cati es el lugar donde cargás tus ítems, tus clientes y tus condiciones — y salís con un documento
          listo para enviar por WhatsApp o email.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/registro"
            className="rounded-md bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:from-brand-700 hover:to-brand-600"
          >
            Empezar gratis
          </Link>
          <Link
            to="/ingresar"
            className="rounded-md border border-line px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink-faint"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <dl className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
          <Feature
            title="Presupuestos completos"
            desc="Ítems, descuentos, impuestos, moneda y condiciones — todo en un mismo lugar."
            color="from-brand-700 to-brand-500"
          />
          <Feature
            title="PDF al instante"
            desc="Generá y compartí un PDF con tu marca en un solo toque."
            color="from-brand-500 to-teal-500"
          />
          <Feature
            title="Tu panel de control"
            desc="Seguí el estado de cada presupuesto: borrador, enviado, aprobado."
            color="from-teal-500 to-brand-500"
          />
        </dl>
      </main>

      <footer className="py-6 text-center text-xs text-ink-faint">Cati · Hecho para vos</footer>
    </div>
  )
}

function Feature({ title, desc, color = 'from-brand-600 to-brand-500' }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface/80 p-5 backdrop-blur-sm">
      <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${color} shadow-soft`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <dt className="font-display text-base font-medium text-ink">{title}</dt>
      <dd className="mt-1.5 text-sm text-ink-soft">{desc}</dd>
    </div>
  )
}
