// ------------------------------------------------------------
// Plantillas de hoja para el PDF.
//
// Una plantilla es el aspecto del papel en el que sale el presupuesto,
// la factura y el recibo: una imagen de fondo y el color con el que se
// dibujan los títulos y las líneas.
//
// Las imágenes las diseñamos nosotros y viven en public/plantillas/.
// No hay subida de archivos: si cada uno pudiera poner la suya, la
// mitad de las facturas saldrían con una foto encima del texto.
// Cómo preparar una nueva está en disenio/COMO-AGREGAR-UNA-PLANTILLA.md.
//
// EL COLOR NO SE GUARDA ACÁ
//   El perfil ya tiene su `brand_color`, que es lo único que mira el
//   PDF. El color de la plantilla es una PROPUESTA: al elegirla en Mi
//   negocio se escribe en ese campo, a la vista y editable. Así no hay
//   dos colores compitiendo a la hora de dibujar, y el que quiere el
//   suyo lo cambia y gana siempre.
//
// SI AGREGÁS UNA
//   La `key` no se cambia nunca: queda guardada en los perfiles. En
//   `rubros` van las keys de src/lib/rubros.js a las que les queda
//   bien; esa lista solo decide el orden en que se muestran, nunca
//   quién puede usarla. Cualquiera puede elegir cualquier plantilla.
// ------------------------------------------------------------

export const PLANTILLAS = [
  {
    key: 'gasista',
    label: 'Gas y plomería',
    descripcion: 'Caños de cobre, manómetro y llave, al pie de la hoja.',
    rubros: ['gasista', 'oficios'],
    fondo: '/plantillas/gasista.jpg',
    color: '#1B3B6F'
  },
  {
    key: 'electricista',
    label: 'Electricidad',
    descripcion: 'Tester, cables, pinza y destornilladores.',
    rubros: ['oficios'],
    fondo: '/plantillas/electricista.jpg',
    color: '#B3282D'
  },
  {
    key: 'albanil',
    label: 'Albañilería y obra',
    descripcion: 'Casco, cuchara, ladrillos, nivel y plano.',
    rubros: ['construccion', 'oficios'],
    fondo: '/plantillas/albanil.jpg',
    color: '#A15C2B'
  },
  {
    key: 'pintor',
    label: 'Pintura',
    descripcion: 'Rodillo, bandeja, latas y pinceles.',
    rubros: ['construccion', 'oficios'],
    fondo: '/plantillas/pintor.jpg',
    color: '#2B6CA3'
  },
  {
    key: 'herrero',
    label: 'Herrería y metalúrgica',
    descripcion: 'Máscara de soldar, guantes, maza y perfiles.',
    rubros: ['herreria', 'oficios'],
    fondo: '/plantillas/herrero.jpg',
    color: '#3F4650'
  },
  {
    key: 'jardineria',
    label: 'Jardinería',
    descripcion: 'Planta, guantes, pala, tijera de podar y manguera.',
    rubros: ['jardineria'],
    fondo: '/plantillas/jardineria.jpg',
    color: '#3F6B3A'
  },
  {
    key: 'automotor',
    label: 'Taller y automotor',
    descripcion: 'Neumático, disco de freno, llaves y bujía.',
    rubros: ['automotor'],
    fondo: '/plantillas/automotor.jpg',
    color: '#37414A'
  },
  {
    key: 'fletes',
    label: 'Fletes y mudanzas',
    descripcion: 'Cajas, carretilla, camioneta y soga.',
    rubros: ['mudanzas'],
    fondo: '/plantillas/fletes.jpg',
    color: '#2E5C8A'
  },
  {
    key: 'gastronomia',
    label: 'Gastronomía',
    descripcion: 'Verduras, tabla, cuchillo, pan y batidor.',
    rubros: ['gastronomia'],
    fondo: '/plantillas/gastronomia.jpg',
    color: '#8C2F2F'
  },
  {
    key: 'imprenta',
    label: 'Imprenta y gráfica',
    descripcion: 'Impresora, pantonera, resma y cutter.',
    rubros: ['imprenta'],
    fondo: '/plantillas/imprenta.jpg',
    color: '#1F6FB0'
  },
  {
    key: 'costura',
    label: 'Indumentaria y textil',
    descripcion: 'Máquina de coser, hilos, telas y tijeras.',
    rubros: ['textil'],
    fondo: '/plantillas/costura.jpg',
    color: '#6B4A3A'
  },
  {
    key: 'fotografia',
    label: 'Fotografía y video',
    descripcion: 'Cámara, estabilizador, micrófono y tarjetas.',
    rubros: ['audiovisual'],
    fondo: '/plantillas/fotografia.jpg',
    color: '#333B45'
  },
  {
    key: 'programacion',
    label: 'Software y sistemas',
    descripcion: 'Notebook con código, teclado, mouse y placa.',
    rubros: ['software', 'tecnologia'],
    fondo: '/plantillas/programacion.jpg',
    color: '#3D4EA8'
  }
]

// La hoja de siempre: sin fondo. Es lo que sale si no se elige nada.
export const HOJA_EN_BLANCO = {
  key: '',
  label: 'Hoja en blanco',
  descripcion: 'Sin fondo, como salía hasta ahora.',
  rubros: [],
  fondo: '',
  color: ''
}

export function getPlantilla(key) {
  return PLANTILLAS.find((p) => p.key === key) || HOJA_EN_BLANCO
}

/**
 * La plantilla que le toca a un perfil.
 *
 * Si eligió una, esa. Si no eligió ninguna todavía, la primera que
 * haya para su rubro: un gasista que recién se registra ya manda con
 * su hoja sin tener que ir a buscarla. Y si su rubro no tiene ninguna,
 * hoja en blanco.
 *
 * El string vacío es una elección válida —«quiero la hoja limpia»— y
 * por eso se distingue de no haber elegido nunca (null/undefined).
 */
export function plantillaDe(profile) {
  const elegida = profile?.plantilla_pdf
  if (typeof elegida === 'string') return getPlantilla(elegida)
  return PLANTILLAS.find((p) => p.rubros.includes(profile?.rubro)) || HOJA_EN_BLANCO
}

/**
 * Todas las plantillas para el selector, las del rubro adelante.
 *
 * No se esconde ninguna: el que quiere una de otro rubro la encuentra
 * más abajo. `delRubro` sirve para separarlas con un título.
 */
export function plantillasPara(rubro) {
  const propias = PLANTILLAS.filter((p) => p.rubros.includes(rubro))
  const resto = PLANTILLAS.filter((p) => !p.rubros.includes(rubro))
  return { propias, resto }
}
