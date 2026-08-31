import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BellRing,
  Briefcase,
  ChartColumn,
  FileText,
  FileUp,
  Gift,
  Palette,
  PenLine,
  Receipt,
  Send,
  ShieldCheck,
  Users
} from 'lucide-react'
import { FREE_FOR_ALL, PROMO_LABEL, FREE_UNTIL_LABEL } from '../lib/config'
import { useSeo } from '../lib/seo'
import SelectorIdioma from '../components/SelectorIdioma'

/**
 * La portada.
 *
 * Está agrupada en tres bloques y no en una lista suelta porque la app ya
 * no hace una sola cosa: quien llega tiene que ver de un vistazo que
 * además del presupuesto están la factura, el recibo, el acuerdo de
 * confidencialidad y la firma. Un listado de doce tarjetas iguales se lee
 * como ruido; tres títulos cuentan una historia.
 */
const BLOQUES = [
  {
    titulo: 'home.seccionPresupuestos',
    items: [
      { key: 'completo', Icono: FileText, color: 'from-brand-700 to-brand-500' },
      { key: 'marca', Icono: Palette, color: 'from-brand-500 to-brass-400' },
      { key: 'enlace', Icono: Send, color: 'from-brass-500 to-brand-600' },
      { key: 'avisos', Icono: BellRing, color: 'from-brand-600 to-brand-300' },
      { key: 'rubro', Icono: Briefcase, color: 'from-brand-700 to-brass-500' },
      { key: 'pdfPropio', Icono: FileUp, color: 'from-brass-400 to-brass-600' }
    ]
  },
  {
    titulo: 'home.seccionDocumentos',
    items: [
      { key: 'facturas', Icono: Receipt, color: 'from-brand-600 to-brand-400' },
      { key: 'confidencialidad', Icono: ShieldCheck, color: 'from-teal-500 to-brand-600' },
      { key: 'firma', Icono: PenLine, color: 'from-brand-700 to-teal-500' }
    ]
  },
  {
    titulo: 'home.seccionNegocio',
    items: [
      { key: 'clientes', Icono: Users, color: 'from-brand-500 to-brand-700' },
      { key: 'reportes', Icono: ChartColumn, color: 'from-brass-500 to-brand-500' },
      { key: 'invitar', Icono: Gift, color: 'from-brass-400 to-brand-600' }
    ]
  }
]

export default function Home() {
  const { t } = useTranslation()
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
        <img src="/logo-numera.png" alt="Numera" className="h-12 w-auto object-contain sm:h-28" />
        <div className="flex items-center gap-3">
          <SelectorIdioma compacto />
          {/* En mobile no entra junto al logo, y el hero ya ofrece "Ya tengo cuenta" */}
          <Link to="/ingresar" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline">
            {t('auth.ingresar')}
          </Link>
          <Link
            to="/registro"
            className="rounded-md bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:from-brand-700 hover:to-brand-600"
          >
            {t('auth.crearCuenta')}
          </Link>
        </div>
      </header>

      {/* Solo en celular: el logo animado ocupa todo el ancho, arriba de
          todo, y abajo el botón que queremos que toquen. */}
      <div className="relative sm:hidden">
        {/* IMAGEN ANIMADA, NUNCA UN <video>. NO CAMBIAR ESTO.
            El visitante no puede ver jamás un botón de play sobre el
            logo: es lo primero que ve un cliente y lo hace parecer roto.
            Un <video> no lo puede garantizar — el iPhone en Modo de bajo
            consumo bloquea el autoplay aunque esté silenciado, y Safari
            dibuja el play encima. Detectarlo por JavaScript tampoco
            sirve: para cuando se detecta, el botón ya se vio. Una imagen
            no pasa por ninguna de esas políticas.

            Es la animación completa, sin recortar y a su velocidad
            original: lo único que cambia respecto del mp4 es el envase.
            A 24 fps, que son los del original (a 15 se nota el tironeo),
            y 600 px de ancho: 1,07 MB, menos de la mitad que el mp4.

            Se arma con:
              ffmpeg -i logoanimado.mp4 -vf "fps=24,scale=600:-2"
                     -c:v libwebp -q:v 58 -compression_level 6
                     -loop 1 -an logoanimado.webp
            El mp4 original está en el commit 9968488.

            El gris de fondo es el del propio archivo, para que mientras
            carga no se vea la foto del hero por detrás. */}
        <img
          src="/logoanimado.webp"
          alt="Numera"
          width={600}
          height={338}
          style={{ backgroundColor: '#D8D8D9' }}
          className="block w-full"
        />

        <div className="px-6 pb-2 pt-5">
          <Link
            to="/registro"
            className="block w-full rounded-xl2 bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-3.5 text-center text-base font-semibold text-white shadow-soft transition active:from-brand-700 active:to-brand-600"
          >
            {t('auth.crearCuenta')}
          </Link>
          <div className="mt-2.5 flex items-center justify-center gap-4">
            <Link to="/ingresar" className="text-sm font-medium text-ink-soft">
              {t('auth.yaTengoCuenta')}
            </Link>
            <SelectorIdioma compacto />
          </div>
        </div>
      </div>

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pt-6 text-center sm:pt-0">
        <h1 className="max-w-3xl font-display text-4xl font-medium leading-tight text-ink sm:text-5xl">
          {t('home.heroTitulo')}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-ink-soft">{t('home.heroSubtitulo')}</p>
        <div className="mt-8 hidden flex-col gap-3 sm:flex sm:flex-row">
          <Link
            to="/registro"
            className="rounded-md bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:from-brand-700 hover:to-brand-600"
          >
            {t('home.empezarGratis')}
          </Link>
          <Link
            to="/ingresar"
            className="rounded-md border border-line px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink-faint"
          >
            {t('auth.yaTengoCuenta')}
          </Link>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          {FREE_FOR_ALL
            ? t('home.promoLibre', { fecha: FREE_UNTIL_LABEL })
            : t('home.promoPrueba', { promo: PROMO_LABEL })}
        </p>

        {BLOQUES.map((bloque, i) => (
          <section key={bloque.titulo} className={`w-full ${i === 0 ? 'mt-16' : 'mt-12'}`}>
            <h2 className="text-left font-display text-xl font-medium text-ink sm:text-center">
              {t(bloque.titulo)}
            </h2>
            <dl className="mt-5 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
              {bloque.items.map(({ key, Icono, color }) => (
                <Feature
                  key={key}
                  Icono={Icono}
                  color={color}
                  title={t(`home.features.${key}.titulo`)}
                  desc={t(`home.features.${key}.desc`)}
                />
              ))}
            </dl>
          </section>
        ))}

        <p className="mt-10 max-w-2xl text-sm text-ink-soft">{t('home.cierre')}</p>
      </main>

      <footer className="py-6 text-center text-xs text-ink-faint">
        <p>{t('home.footerLema')}</p>
        <p className="mt-1">
          {t('auth.desarrollo')} <span className="font-medium text-ink-soft">sTuDiO-B2B</span>
        </p>
      </footer>
    </div>
  )
}

function Feature({ title, desc, Icono, color = 'from-brand-600 to-brand-500' }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface/80 p-5 backdrop-blur-sm">
      <span
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${color} shadow-soft`}
      >
        <Icono size={18} color="#fff" strokeWidth={2} aria-hidden="true" />
      </span>
      <dt className="font-display text-base font-medium text-ink">{title}</dt>
      <dd className="mt-1.5 text-sm text-ink-soft">{desc}</dd>
    </div>
  )
}
