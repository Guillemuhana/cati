import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
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
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center">
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
            className="rounded-md bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
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
          <Feature title="Presupuestos completos" desc="Ítems, descuentos, impuestos, moneda y condiciones — todo en un mismo lugar." />
          <Feature title="PDF al instante" desc="Generá y compartí un PDF con tu marca en un solo toque." />
          <Feature title="Tu panel de control" desc="Seguí el estado de cada presupuesto: borrador, enviado, aprobado." />
        </dl>
      </main>

      <footer className="py-6 text-center text-xs text-ink-faint">Cati · Hecho para vos</footer>
    </div>
  )
}

function Feature({ title, desc }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-5">
      <dt className="font-display text-base font-medium text-ink">{title}</dt>
      <dd className="mt-1.5 text-sm text-ink-soft">{desc}</dd>
    </div>
  )
}
