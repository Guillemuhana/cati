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
// Cómo preparar una nueva está en public/plantillas/LEEME.md.
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
