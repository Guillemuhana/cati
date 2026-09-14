// ------------------------------------------------------------
// Las páginas de aterrizaje por oficio.
//
// Cuando un gasista busca «cómo hacer un presupuesto de gas», hoy no
// llega a Numera: la única página que Google puede indexar es la
// portada, y ahí no dice gas en ningún lado. Estas páginas existen para
// ese momento.
//
// EL CONTENIDO SALE DE LO QUE LA APP YA SABE
//   El rubro trae sus campos, sus condiciones y su ejemplo de ítem
//   (rubros.js), y muchos tienen su hoja membretada (plantillas.js).
//   Eso es contenido de verdad: describe lo que la persona se va a
//   encontrar. Ninguna página inventa nada para tener texto.
//
// POR QUÉ NO ESTÁN TODOS LOS RUBROS
//   Solo los que tienen algo concreto que mostrar. Una página que
//   repite la portada con otro título no posiciona: compite consigo
//   misma y le enseña a Google que el sitio tiene relleno.
//
// LAS DIRECCIONES NO SE CAMBIAN
//   Una vez que Google las conoce, cambiar el slug tira a la basura lo
//   que se ganó. Si alguna vez hay que moverlas, se moverán con una
//   redirección, no editando esta lista.
// ------------------------------------------------------------

// Con la extensión escrita: este archivo lo lee Vite (que la resuelve
// sola) y también Node, cuando scripts/sitemap.mjs lo importa para
// generar el XML. Node no adivina.
import { RUBROS, getRubro } from './rubros.js'
import { PLANTILLAS } from './plantillas.js'

// El dominio para las direcciones canónicas y el sitemap.
//
// Está escrito acá y en ningún otro lado: el día que haya dominio
// propio se cambia esta línea y se regeneran sitemap y canónicas
// solas. Un sitemap con el dominio viejo le dice a Google que el
// contenido vive en otra parte.
export const SITIO = 'https://numera-presupuestos.vercel.app'

/**
 * Qué oficios tienen página.
 *
 * `slug` es lo que va en la dirección y `busca` es cómo lo escribe la
 * persona en Google, que casi nunca coincide con cómo lo llamamos
 * nosotros en el menú: nadie busca «oficios», busca «plomero».
 */
const LANDINGS = [
  { rubro: 'oficios', slug: 'plomeros-y-gasistas', busca: 'plomeros y gasistas' },
  { rubro: 'gasista', slug: 'gasistas', busca: 'gasistas' },
  { rubro: 'construccion', slug: 'albaniles-y-obra', busca: 'albañiles y empresas de obra' },
  { rubro: 'arquitectura', slug: 'arquitectos', busca: 'arquitectos e ingenieros' },
  { rubro: 'herreria', slug: 'herreros', busca: 'herreros y metalúrgicas' },
  { rubro: 'carpinteria', slug: 'carpinteros', busca: 'carpinteros' },
  { rubro: 'seguridad', slug: 'instaladores-de-camaras', busca: 'instaladores de cámaras y alarmas' },
  { rubro: 'jardineria', slug: 'jardineros', busca: 'jardineros y paisajistas' },
  { rubro: 'limpieza', slug: 'servicios-de-limpieza', busca: 'empresas de limpieza' },
  { rubro: 'mudanzas', slug: 'fletes-y-mudanzas', busca: 'fletes y mudanzas' },
  { rubro: 'automotor', slug: 'talleres-mecanicos', busca: 'talleres mecánicos' },
  { rubro: 'gastronomia', slug: 'catering-y-gastronomia', busca: 'catering y gastronomía' },
  { rubro: 'eventos', slug: 'eventos-y-sonido', busca: 'eventos, sonido y espectáculos' },
  { rubro: 'audiovisual', slug: 'fotografos', busca: 'fotógrafos y videastas' },
  { rubro: 'diseno', slug: 'disenadores-graficos', busca: 'diseñadores gráficos' },
  { rubro: 'marketing', slug: 'agencias-de-marketing', busca: 'agencias de marketing' },
  { rubro: 'software', slug: 'desarrolladores-de-software', busca: 'desarrolladores de software' },
  { rubro: 'tecnologia', slug: 'soporte-tecnico', busca: 'soporte técnico y redes' },
  { rubro: 'imprenta', slug: 'imprentas', busca: 'imprentas y gráficas' },
  { rubro: 'textil', slug: 'talleres-textiles', busca: 'talleres textiles e indumentaria' },
  { rubro: 'belleza', slug: 'peluquerias-y-barberias', busca: 'peluquerías y barberías' },
  { rubro: 'agro', slug: 'agro-y-maquinaria', busca: 'agro y maquinaria' },
  { rubro: 'servicios', slug: 'consultores', busca: 'consultores y estudios profesionales' },
  { rubro: 'educacion', slug: 'capacitaciones', busca: 'cursos y capacitaciones' }
]

/** La hoja membretada del oficio, si tiene. */
function hojaDe(rubroKey) {
  return PLANTILLAS.find((p) => p.rubros.includes(rubroKey)) || null
}

/**
 * Todo lo que una página necesita, ya armado.
 *
 * Se descartan los slugs cuyo rubro no exista: si alguien borra un
 * rubro de rubros.js, es mejor que la página desaparezca a que salga
 * con los textos del rubro genérico.
 */
export const PAGINAS = LANDINGS.map((l) => {
  const rubro = RUBROS.find((r) => r.key === l.rubro)
  if (!rubro) return null

  const hoja = hojaDe(l.rubro)
  return {
    slug: l.slug,
    busca: l.busca,
    rubroKey: l.rubro,
    label: rubro.label,
    campos: rubro.fields || [],
    condiciones: rubro.terms || '',
    formaPago: rubro.payment_terms || '',
    mediosPago: rubro.payment_methods || '',
    validez: rubro.validity || null,
    ejemploItem: rubro.itemPlaceholder || '',
    hoja: hoja ? { label: hoja.label, fondo: hoja.fondo, descripcion: hoja.descripcion } : null,
    url: `${SITIO}/presupuestos-para/${l.slug}`,
    // Sin «· Numera» al final: useSeo se lo agrega solo, y escribirlo
    // acá dejaba el nombre dos veces en la pestaña y en Google.
    titulo: `Presupuestos para ${l.busca}`,
    // La descripción es lo que se lee debajo del título en Google. Dice
    // qué hace la app para ESE oficio, no qué es la app.
    descripcion: `Hacé presupuestos de ${l.busca} en minutos: ítems, condiciones y total calculado. Mandalos por WhatsApp en PDF y enterate cuándo los abren. Probalo gratis.`
  }
}).filter(Boolean)

export function getPagina(slug) {
  return PAGINAS.find((p) => p.slug === slug) || null
}

/** Para enlazar unas con otras: Google entiende mejor lo que está unido. */
export function otrasPaginas(slug, cuantas = 6) {
  const i = PAGINAS.findIndex((p) => p.slug === slug)
  if (i < 0) return PAGINAS.slice(0, cuantas)
  const giradas = [...PAGINAS.slice(i + 1), ...PAGINAS.slice(0, i)]
  return giradas.slice(0, cuantas)
}

export { getRubro }
