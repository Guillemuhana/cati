import { Link } from 'react-router-dom'
import { FREE_FOR_ALL, PROMO_LABEL, FREE_UNTIL_LABEL } from '../lib/config'
import { useSeo } from '../lib/seo'

export default function Home() {
  useSeo()
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      {/* Foto de fondo del hero, velada para que el texto siga legible */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[85vh] overflow-hidden" aria-hidden="true">
        <img src="/fondo.jpg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-paper/45" />
        <div className="absolute inset-0 bg-gradient-to-b from-paper/10 via-paper/35 to-paper" />
        {/* Halo detrás del bloque de texto, para que el gris del subtítulo no
            compita con las zonas claras de la foto */}
        <div className="absolute left-1/2 top-[46%] h-[30rem] w-[58rem] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/70 blur-3xl" />
      </div>

      {/* Degradados decorativos con los colores del logo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute top-32 right-[-6rem] h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-4rem] h-64 w-64 rounded-full bg-brand-700/[0.06] blur-3xl" />
      </div>

      {/* En celular el header no existe: arriba de todo va el video, y el
          botón de crear cuenta queda abajo suyo. */}
      <header className="relative mx-auto hidden w-full max-w-5xl items-center justify-between px-6 py-6 sm:flex">
        <img src="/logo-numera.png" alt="Numera" className="h-12 w-auto object-contain sm:h-20" />
        <div className="flex items-center gap-3">
          {/* En mobile no entra junto al logo, y el hero ya ofrece "Ya tengo cuenta" */}
          <Link to="/ingresar" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline">
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

      {/* Solo en celular: el logo animado ocupa todo el ancho, arriba de
          todo, y abajo el botón que queremos que toquen. */}
      <div className="relative sm:hidden">
        {/* Imagen animada, no video, y no es un capricho: iOS en Modo de
            bajo consumo NO deja arrancar solo ningún <video>, ni siquiera
            silenciado, y aparece el botón de play. Un WebP animado no pasa
            por esa regla: se reproduce siempre, sin controles y sin que
            nadie toque nada. Encima pesa menos que el mp4 (665 KB contra
            2,4 MB). Se reproduce una vez y queda fija en el cierre.
            El archivo se arma con:
              ffmpeg -ss 0.55 -to 8.30 -i logoanimado.mp4                 -vf "fps=15,scale=720:-2" -c:v libwebp -q:v 62                 -compression_level 6 -loop 1 -an logoanimado.webp */}
        <img
          src="/logoanimado.webp"
          alt="Numera"
          width={720}
          height={406}
          className="block w-full"
        />
        <div className="px-6 pb-2 pt-5">
          <Link
            to="/registro"
            className="block w-full rounded-xl2 bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-3.5 text-center text-base font-semibold text-white shadow-soft transition active:from-brand-700 active:to-brand-600"
          >
            Crear cuenta
          </Link>
          <Link
            to="/ingresar"
            className="mt-2.5 block text-center text-sm font-medium text-ink-soft"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pt-6 text-center sm:pt-0">
        <span className="stamp mb-6 inline-flex items-center rounded-md border-2 border-brand-500/40 bg-brand-500/[0.08] px-3 py-1 font-display text-xs font-semibold uppercase tracking-wider text-brand-700">
          Presupuestos, sin vueltas
        </span>

        <h1 className="font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
          Armá presupuestos prolijos y compartilos en PDF en minutos
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-soft">
          Numera es el lugar donde cargás tus ítems, tus clientes y tus condiciones — y salís con un documento
          listo para enviar por WhatsApp o email.
        </p>
        <div className="mt-8 hidden flex-col gap-3 sm:flex sm:flex-row">
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
        <p className="mt-3 text-xs text-ink-faint">
          {FREE_FOR_ALL
            ? `Gratis con todas las funciones hasta el ${FREE_UNTIL_LABEL} · sin tarjeta`
            : `${PROMO_LABEL} gratis con todo desbloqueado · después USD 2/mes · cancelás cuando quieras`}
        </p>

        <dl className="mt-16 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
          <Feature
            title="Presupuestos completos"
            desc="Ítems, descuentos, impuestos, moneda y condiciones — todo en un mismo lugar."
            color="from-brand-700 to-brand-500"
          />
          <Feature
            title="PDF al instante"
            desc="Generá y compartí un PDF con tu marca en un solo toque."
            color="from-brand-500 to-brass-400"
          />
          <Feature
            title="Tu panel de control"
            desc="Seguí el estado de cada presupuesto: enviado, visto, aceptado."
            color="from-brass-500 to-brand-600"
          />
        </dl>
      </main>

      <footer className="py-6 text-center text-xs text-ink-faint">
        <p>Numera · Hecho para vos</p>
        <p className="mt-1">
          Desarrollo <span className="font-medium text-ink-soft">sTuDiO-B2B</span>
        </p>
      </footer>
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
