import { Link, Navigate, useParams } from 'react-router-dom'
import { getPagina, otrasPaginas, PAGINAS } from '../lib/landings'
import { useSeo } from '../lib/seo'
import { TRIAL_DAYS, PREMIUM_PRICE_FULL } from '../lib/config'

/**
 * La página que ve alguien que llegó de Google buscando su oficio.
 *
 * No es la portada con otro título: muestra lo que la app ya sabe de
 * ESE oficio —los campos que le va a ofrecer, las condiciones que le
 * deja escritas, la hoja con la que salen sus PDF—, que es justo lo
 * que la persona quiere saber antes de registrarse.
 *
 * Es pública y sin login a propósito: una página de aterrizaje detrás
 * de una pantalla de ingreso no la indexa nadie.
 */
export default function RubroLanding() {
  const { slug } = useParams()
  const pagina = getPagina(slug)

  // Un slug que no existe no es un error que valga una pantalla: se
  // manda a la portada, que es lo que esa persona estaba buscando.
  if (!pagina) return <Navigate to="/" replace />

  return <Contenido pagina={pagina} />
}

function Contenido({ pagina }) {
  useSeo({ title: pagina.titulo, description: pagina.descripcion, canonical: pagina.url })

  const otras = otrasPaginas(pagina.slug)

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/numera-icon.png" alt="" className="h-10 w-10" />
            <span className="font-display text-xl font-medium text-ink">Numera</span>
          </Link>
          <Link to="/registro" className="btn-primary rounded-md px-4 py-2 text-sm font-semibold">
            Probar gratis
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-medium leading-tight text-ink sm:text-4xl">
          Presupuestos para {pagina.busca}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
          Cargá los ítems con cantidad y precio, y la app calcula el subtotal, el descuento, el
          impuesto y el total. Lo mandás por WhatsApp en PDF o con un enlace que el cliente abre y
          acepta desde el celular, y te enterás cuándo lo vio.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/registro" className="btn-primary rounded-md px-5 py-2.5 text-sm font-semibold">
            Empezar gratis · {TRIAL_DAYS} días
          </Link>
          <Link
            to="/ingresar"
            className="rounded-md border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink-faint"
          >
            Ya tengo cuenta
          </Link>
        </div>

        {/* Lo propio del oficio. Esto es lo que hace que la página valga
            la pena: si dijera lo mismo que la portada, no serviría ni
            para el que la lee ni para el buscador. */}
        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          {pagina.campos.length > 0 && (
            <Bloque titulo={`Los datos de un trabajo de ${pagina.busca}`}>
              <p className="mb-3 text-sm text-ink-soft">
                El presupuesto te ofrece estos campos ya escritos, para que no tengas que inventarlos
                cada vez:
              </p>
              <ul className="space-y-1.5">
                {pagina.campos.map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-ink">
                    <span className="text-teal-500">·</span>
                    {c}
                  </li>
                ))}
              </ul>
            </Bloque>
          )}

          {pagina.condiciones && (
            <Bloque titulo="Las condiciones, ya redactadas">
              <p className="text-sm leading-relaxed text-ink-soft">«{pagina.condiciones}»</p>
              <p className="mt-3 text-xs text-ink-faint">
                Vienen escritas y las cambiás cuando quieras. Es un punto de partida, nunca una regla.
              </p>
            </Bloque>
          )}

          {pagina.formaPago && (
            <Bloque titulo="Cómo se cobra en tu rubro">
              <p className="text-sm leading-relaxed text-ink-soft">{pagina.formaPago}</p>
              {pagina.mediosPago && (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pagina.mediosPago}</p>
              )}
              <p className="mt-3 text-xs text-ink-faint">
                Y podés anotar lo que te van pagando: seña, anticipo y saldo, cada uno con su
                comprobante.
              </p>
            </Bloque>
          )}

          {pagina.hoja && (
            <Bloque titulo="Tu hoja, no una en blanco">
              <div className="flex gap-4">
                <img
                  src={pagina.hoja.fondo}
                  alt={`Hoja de presupuesto para ${pagina.busca}`}
                  loading="lazy"
                  className="h-32 w-auto rounded border border-line"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{pagina.hoja.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {pagina.hoja.descripcion}
                  </p>
                </div>
              </div>
            </Bloque>
          )}
        </section>

        <section className="mt-12 rounded-xl2 border border-line bg-surface p-6">
          <h2 className="font-display text-xl font-medium text-ink">Qué más trae</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              'Clientes y catálogo de precios, para no reescribir lo de siempre',
              'PDF con tu logo, tus datos y tu color',
              'Enlace con QR para que el cliente lo abra y lo acepte',
              'Avisos de visto, aceptado y rechazado',
              'Comprobantes y recibos desde el mismo presupuesto',
              'Reportes de lo aceptado y exportación a Excel'
            ].map((x) => (
              <li key={x} className="flex gap-2 text-sm text-ink-soft">
                <span className="mt-0.5 text-teal-500">✓</span>
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-ink-soft">
            Se prueba {TRIAL_DAYS} días con todo incluido. Después son {PREMIUM_PRICE_FULL} y se
            cancela cuando quieras.
          </p>
          <Link
            to="/registro"
            className="btn-primary mt-4 inline-flex rounded-md px-5 py-2.5 text-sm font-semibold"
          >
            Crear mi cuenta
          </Link>
        </section>

        {/* Enlazadas entre sí: lo que está unido se entiende mejor, y el
            que entró por un oficio a veces trabaja en dos. */}
        <section className="mt-12">
          <h2 className="font-display text-lg font-medium text-ink">Para otros oficios</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {otras.map((o) => (
              <li key={o.slug}>
                <Link
                  to={`/presupuestos-para/${o.slug}`}
                  className="inline-flex rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft transition hover:border-ink-faint hover:text-ink"
                >
                  {o.busca}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-ink-faint">
          <Link to="/" className="hover:text-ink">
            Numera
          </Link>{' '}
          · Presupuestos y comprobantes para tu oficio · {PAGINAS.length} rubros
        </div>
      </footer>
    </div>
  )
}

function Bloque({ titulo, children }) {
  return (
    <section className="rounded-xl2 border border-line bg-surface p-5">
      <h2 className="mb-3 font-display text-base font-medium text-ink">{titulo}</h2>
      {children}
    </section>
  )
}
