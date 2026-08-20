import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PROMO_LABEL, PREMIUM_PRICE_FULL, FREE_FOR_ALL, FREE_UNTIL_LABEL } from '../lib/config'

// Instructivo en 5 pasos: el orden recomendado para arrancar de cero.
const STEPS = [
  {
    title: 'Cargá los datos de tu negocio',
    to: '/perfil',
    cta: 'Ir a Mi negocio',
    body: 'Nombre, teléfono, CUIT, dirección, logo y moneda. Todo esto aparece en el encabezado de cada presupuesto que compartís, así que conviene hacerlo una sola vez y bien. También podés dejar escritas las condiciones y formas de pago por defecto para no repetirlas en cada presupuesto.'
  },
  {
    title: 'Anotá tus clientes',
    to: '/clientes',
    cta: 'Ir a Clientes',
    body: 'Cargá nombre, email y teléfono. No es obligatorio hacerlo antes: cuando estés armando un presupuesto podés crear el cliente en el momento con «+ Nuevo cliente». Tenerlos guardados sirve para reusarlos y para ver después cuánto le presupuestaste a cada uno.'
  },
  {
    title: 'Armá tu catálogo (opcional pero recomendado)',
    to: '/catalogo',
    cta: 'Ir a Catálogo',
    body: 'Son los productos o servicios que vendés siempre, con su precio. Después, al hacer un presupuesto, los agregás con un clic en vez de escribirlos de nuevo. Si trabajás a medida y nunca repetís ítems, podés saltear este paso.'
  },
  {
    title: 'Hacé tu primer presupuesto',
    to: '/presupuestos/nuevo',
    cta: 'Nuevo presupuesto',
    body: 'Elegí el cliente, agregá los ítems (descripción, cantidad y precio), y la app calcula sola el subtotal, el descuento, el impuesto y el total. Antes de guardar podés tocar «Vista previa» para ver exactamente cómo le va a llegar al cliente.'
  },
  {
    title: 'Mandáselo al cliente y seguí la respuesta',
    to: '/presupuestos',
    cta: 'Ver mis presupuestos',
    body: 'Desde el presupuesto ya guardado podés descargar el PDF, compartirlo por WhatsApp o mail, o mandar el enlace público con QR para que el cliente lo vea y lo acepte online. Cuando lo acepte, cambiás el estado a «Aceptado» y, si querés, lo convertís en comprobante.'
  }
]

// Preguntas frecuentes. `keywords` suma términos para el buscador (sinónimos,
// formas en que la gente pregunta lo mismo).
const FAQS = [
  {
    q: '¿Por dónde empiezo si nunca usé la app?',
    a: 'Seguí los 5 pasos de arriba en orden. Lo mínimo indispensable para mandar tu primer presupuesto es: completar «Mi negocio» y después ir a Presupuestos → Nuevo presupuesto. Con eso alcanza; el resto lo vas sumando cuando lo necesites.',
    keywords: 'empezar arrancar primera vez nuevo principiante tutorial'
  },
  {
    q: '¿Cómo creo un presupuesto?',
    a: 'Entrá a Presupuestos y tocá «Nuevo presupuesto». Elegí el cliente, escribí los ítems con cantidad y precio unitario, y revisá el total a la derecha. Podés agregar descuento (por porcentaje o monto fijo), IVA, anticipo/seña, notas y condiciones. Al final tocá «Guardar».',
    keywords: 'crear hacer armar presupuesto cotizacion cotización nuevo'
  },
  {
    q: '¿Tengo que cargar el cliente antes de presupuestar?',
    a: 'No. Dentro del formulario, en el selector de cliente, tenés la opción «+ Nuevo cliente»: ponés nombre (lo único obligatorio), email y teléfono, y con «Crear y usar» queda cargado y elegido de una.',
    keywords: 'cliente nuevo cargar alta obligatorio'
  },
  {
    q: '¿Para qué sirve el rubro?',
    a: 'Lo elegís al crear la cuenta y lo cambiás cuando quieras en «Mi negocio». Sirve para que un presupuesto nuevo arranque con las condiciones, las formas de pago y la validez que se usan en tu rubro, en vez de nacer vacío. Es solo un punto de partida: lo que vos hayas escrito en «Mi negocio» siempre manda, y en cada presupuesto podés editar todo. No te limita ninguna función de la app.',
    keywords: 'rubro actividad oficio profesion profesión sugerencias condiciones defecto'
  },
  {
    q: '¿Puedo ponerle el logo a un cliente?',
    a: 'Sí. En Clientes, al crear o editar uno, arriba de todo tenés «Subir logo». Es opcional: solo si ese cliente tiene logo propio. Queda visible en la lista de clientes y en el presupuesto.',
    keywords: 'logo cliente imagen marca subir foto isotipo'
  },
  {
    q: '¿Cómo le mando el presupuesto al cliente?',
    a: 'Abrí el presupuesto guardado. Tenés tres formas: «Descargar PDF» (te lo baja al dispositivo), «Compartir PDF» (abre el menú de compartir del celular: WhatsApp, mail, lo que tengas) y el enlace público con QR, que le permite al cliente verlo online desde el navegador sin instalar nada.',
    keywords: 'enviar mandar compartir whatsapp mail email pdf link enlace qr'
  },
  {
    q: '¿Qué es el enlace público y el QR?',
    a: 'Es una página web con tu presupuesto que solo ve quien tenga el link. El cliente lo abre, lo lee y puede aceptarlo o rechazarlo desde ahí mismo. Vos te enterás en el acto: en el presupuesto aparece «Visto», «Aceptado» o «Rechazado» con la fecha. El QR es ese mismo enlace en imagen, para mostrarlo en persona o imprimirlo.',
    keywords: 'link enlace publico público qr aceptar online seguimiento visto'
  },
  {
    q: '¿Qué significa cada estado?',
    a: 'Enviado: es el estado con el que nace todo presupuesto, listo para mandarle al cliente. Visto: el cliente abrió el enlace público. Aceptado: te dijo que sí. Rechazado: te dijo que no. Vencido: pasó la fecha de validez sin respuesta. Podés cambiarlo a mano desde el presupuesto, en «Cambiar estado».',
    keywords: 'estado estados enviado visto aceptado rechazado vencido significa'
  },
  {
    q: '¿Cómo cargo el descuento, el IVA o la seña?',
    a: 'Están en el formulario del presupuesto, debajo de los ítems. El descuento puede ser un porcentaje o un monto fijo, y también podés poner un descuento distinto en cada ítem por separado. El IVA tiene botones rápidos (sin IVA, 10,5%, 21%) o lo escribís vos. El anticipo/seña se resta del total y muestra el saldo pendiente.',
    keywords: 'descuento iva impuesto seña seña anticipo saldo porcentaje total calcular'
  },
  {
    q: '¿Puedo reusar un presupuesto que ya hice?',
    a: 'Sí, de dos maneras. «Duplicar» (abajo a la derecha en el presupuesto) crea una copia idéntica para editarla. Y si es algo que hacés seguido, en el formulario tenés «Guardar como plantilla»: le ponés un nombre y después la aplicás desde el desplegable «Usar plantilla…» en cualquier presupuesto nuevo.',
    keywords: 'duplicar copiar repetir plantilla plantillas modelo template reusar'
  },
  {
    q: '¿Cómo edito o borro un presupuesto?',
    a: 'Abrilo desde la lista de Presupuestos. Arriba a la derecha está «Editar». Para eliminarlo, bajá hasta el final de la columna derecha y tocá «Eliminar»: te va a pedir confirmación porque no se puede deshacer.',
    keywords: 'editar modificar cambiar borrar eliminar deshacer'
  },
  {
    q: '¿Qué son las facturas de la app? ¿Sirven para AFIP?',
    a: 'No. Son comprobantes internos, no fiscales: sirven para dejar constancia de un trabajo cerrado y para tu propio orden. No reemplazan la factura electrónica de AFIP ni de ningún organismo. Se generan desde un presupuesto con el botón «Convertir en factura».',
    keywords: 'factura facturas afip fiscal comprobante remito recibo legal impuestos'
  },
  {
    q: '¿Para qué sirve el Catálogo?',
    a: 'Para guardar los productos o servicios que vendés siempre con su precio. Cuando armás un presupuesto los buscás y los insertás como ítem con un clic, sin volver a escribir descripción ni precio. Si cambiás un precio en el catálogo, afecta a los presupuestos nuevos, no a los ya emitidos.',
    keywords: 'catalogo catálogo productos servicios precios lista items ítems'
  },
  {
    q: '¿Qué me muestran los Reportes?',
    a: 'Cuántos presupuestos hiciste, cuántos te aceptaron, tu tasa de aceptación, el monto total emitido, la facturación aceptada de los últimos 6 meses y tus mejores clientes por monto. Con «Exportar CSV» te bajás todo para abrirlo en Excel o Google Sheets.',
    keywords: 'reportes reporte estadisticas estadísticas metricas números excel csv exportar'
  },
  {
    q: '¿Puedo poner mi logo y mis colores en el PDF?',
    a: 'Sí. El logo se sube en «Mi negocio» y sale en todos los presupuestos. Ahí mismo, en el bloque «Marca y numeración», elegís el color de marca del PDF, el prefijo de tus números (por ejemplo PRES-2026-0001) y podés ocultar el «Generado con Numera» del pie.',
    keywords: 'logo marca color pdf personalizar branding numeracion numeración prefijo'
  },
  {
    q: 'El PDF no se descarga o sale mal, ¿qué hago?',
    a: 'Probá con «Compartir PDF» en vez de «Descargar PDF» si estás en el celular. Si aparece un mensaje de error en rojo, revisá que en «Mi negocio» esté cargado al menos el nombre del negocio. Si subiste un logo muy pesado, probá con una imagen más chica (PNG o JPG de menos de 1 MB).',
    keywords: 'pdf error falla no descarga problema no funciona roto'
  },
  {
    q: '¿Cuánto cuesta? ¿Se me vence?',
    a: FREE_FOR_ALL
      ? `Hasta el ${FREE_UNTIL_LABEL} está todo gratis y desbloqueado, sin tarjeta y sin límite de presupuestos. A partir de esa fecha termina la etapa gratuita y las funciones premium pasan a costar ${PREMIUM_PRICE_FULL}, que se cancela cuando quieras. Te vamos a avisar antes, y lo que ya cargaste no se borra ni se pierde nunca.`
      : `La etapa gratuita terminó el ${FREE_UNTIL_LABEL}. Las funciones premium siguen por ${PREMIUM_PRICE_FULL} y se cancela cuando quieras. Los presupuestos que ya hiciste no se borran nunca: siempre los podés ver y descargar.`,
    keywords: 'precio costo pagar gratis premium suscripcion suscripción plan prueba trial noviembre 2026 vence termina'
  },
  {
    q: '¿Qué pasa el 1 de noviembre de 2026 con lo que ya cargué?',
    a: 'Nada se borra. Tus presupuestos, clientes, catálogo y comprobantes siguen ahí: los vas a poder ver, buscar y descargar en PDF igual que siempre. Lo que pide suscripción a partir de esa fecha es crear y editar funciones premium (catálogo, plantillas, enlace público, comprobantes y reportes). Es a propósito: si un mes no podés pagar, no perdés tu trabajo.',
    keywords: 'noviembre 2026 termina vence gratis pierdo datos borra que pasa despues'
  },
  {
    q: '¿Cómo consigo los 3 meses gratis invitando gente?',
    a: 'Entrá a «Invitar y ganar» en el menú: ahí tenés tu link personal (y un QR) para pasarle a quien quieras. Podés sumar hasta 3 invitados. Cuando los 3 crearon su cuenta desde tu link y confirmaron el email, se te acreditan 3 meses de premium solos, sin que tengas que reclamar nada.',
    keywords: 'invitar recomendar referido link amigos regalo premio 3 meses gratis compartir app'
  },
  {
    q: 'Invité a alguien pero no me figura, ¿por qué?',
    a: 'Tres motivos posibles. Uno: se registró pero todavía no confirmó el email, así que aparece como «Falta confirmar» y no cuenta todavía. Dos: no entró por tu link (si se anotó escribiendo la dirección a mano, no queda registrado). Tres: ya tenías 3 invitados confirmados y el cupo está lleno. Lo más seguro es que abra el link que le mandaste y complete el registro ahí mismo.',
    keywords: 'invitado no aparece figura cuenta referido pendiente confirmar problema'
  },
  {
    q: '¿Puedo invitarme a mí mismo con otro mail?',
    a: 'No, el sistema descarta la autoinvitación y las cuentas que no confirman el email. El premio es para que la app llegue a gente que la va a usar de verdad.',
    keywords: 'trampa auto invitarme mismo mail falso abusar truco'
  },
  {
    q: '¿Mis datos están seguros? ¿Los ve alguien más?',
    a: 'Cada cuenta ve únicamente sus propios clientes, presupuestos y productos: nadie más accede a lo tuyo. La única excepción es el enlace público de un presupuesto, que a propósito puede abrir cualquiera que tenga ese link exacto (por eso conviene mandarlo solo al cliente).',
    keywords: 'seguridad privacidad datos backup respaldo ve otro usuario'
  },
  {
    q: '¿Funciona en el celular? ¿Y sin internet?',
    a: 'Sí, funciona en el navegador del celular igual que en la computadora, con un menú abajo para moverte rápido. Sin internet no anda: los datos se guardan en la nube, así que necesitás conexión para cargar y guardar.',
    keywords: 'celular movil móvil telefono teléfono tablet offline internet conexion app instalar'
  },
  {
    q: 'Me equivoqué en un dato del negocio, ¿los presupuestos viejos cambian?',
    a: 'Los datos de tu negocio (nombre, logo, teléfono) se toman al generar el PDF, así que si los corregís, los presupuestos anteriores también salen corregidos la próxima vez que los descargues. En cambio los ítems y precios quedan congelados como los guardaste.',
    keywords: 'corregir error dato negocio cambia viejo anterior historico'
  }
]

export default function Ayuda() {
  const [query, setQuery] = useState('')
  const [openIndex, setOpenIndex] = useState(null)

  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return FAQS
    return FAQS.filter((f) => normalize(`${f.q} ${f.a} ${f.keywords}`).includes(q))
  }, [query])

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium text-ink">Ayuda</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Cómo usar Numera de cero, paso a paso, y las dudas más comunes. Si es tu primera vez, empezá por el paso 1.
        </p>
      </header>

      {/* Instructivo */}
      <section className="rounded-xl2 border border-line bg-surface p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-lg font-medium text-ink">Primeros pasos</h2>
        <p className="mt-1 text-sm text-ink-soft">
          En 10 minutos podés tener tu primer presupuesto en manos del cliente.
        </p>

        <ol className="mt-5 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/[0.11] font-display text-sm font-semibold text-brand-700">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
                <Link
                  to={step.to}
                  className="mt-2 inline-block text-sm font-medium text-brand-600 transition hover:text-brand-700"
                >
                  {step.cta} →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Preguntas frecuentes */}
      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-medium text-ink">Preguntas frecuentes</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar una duda..."
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:w-64"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl2 border border-line bg-surface">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-ink-soft">No encontramos nada con «{query}».</p>
              <p className="mt-1 text-xs text-ink-faint">
                Probá con otra palabra o escribinos y te ayudamos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((faq) => {
                const isOpen = openIndex === faq.q
                return (
                  <li key={faq.q}>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : faq.q)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-brand-500/[0.04]"
                    >
                      <span className="text-sm font-medium text-ink">{faq.q}</span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        width="16"
                        height="16"
                        className={`shrink-0 text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <p className="px-5 pb-4 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Glosario rápido */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-medium text-ink">Qué es cada sección</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ['Panel', 'El resumen de tu actividad: lo último que hiciste y cómo venís.'],
            ['Presupuestos', 'La lista de todo lo que cotizaste, con su estado.'],
            ['Facturas', 'Comprobantes internos (no fiscales) generados desde un presupuesto.'],
            ['Catálogo', 'Tus productos y servicios con precio, para reusarlos.'],
            ['Clientes', 'Tu agenda: nombre, email y teléfono de cada uno.'],
            ['Reportes', 'Números y exportación a Excel/CSV.'],
            ['Mi negocio', 'Tus datos, logo y condiciones por defecto del PDF.'],
            ['Invitar y ganar', 'Tu link para recomendar la app: 3 invitados = 3 meses de premium.'],
            ['Ayuda', 'Esta página. Volvé cuando quieras.']
          ].map(([term, desc]) => (
            <div key={term} className="rounded-xl2 border border-line bg-surface px-4 py-3">
              <dt className="text-sm font-semibold text-ink">{term}</dt>
              <dd className="mt-0.5 text-sm text-ink-soft">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 rounded-xl2 border border-dashed border-brand-500/40 bg-brand-500/[0.04] p-5 text-center">
        <p className="text-sm font-semibold text-ink">¿Te quedó una duda que no está acá?</p>
        <p className="mt-1 text-sm text-ink-soft">
          Escribinos y la sumamos a esta guía. Mientras tanto, lo más rápido para aprender es{' '}
          <Link to="/presupuestos/nuevo" className="font-medium text-brand-600 hover:text-brand-700">
            armar un presupuesto de prueba
          </Link>{' '}
          y borrarlo después.
        </p>
      </div>
    </div>
  )
}

// Saca acentos y mayúsculas para que el buscador encuentre "cotizacion" y "cotización".
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
