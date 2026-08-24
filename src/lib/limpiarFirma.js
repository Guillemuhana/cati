/**
 * Convierte la FOTO de una firma hecha en papel en un PNG con fondo
 * transparente, listo para poner sobre la línea de firma de un documento.
 *
 * El problema: una foto de un papel no es blanco y negro. Es papel gris,
 * con sombra de un lado, más claro del otro, y el trazo nunca es negro
 * puro. Pegar esa foto tal cual en un PDF deja un rectángulo gris con
 * bordes visibles arriba de la línea de firma. Se nota, y mucho.
 *
 * Lo que hace, en orden:
 *   1. Escala de grises.
 *   2. Umbral de Otsu, que lo calcula la propia imagen. Un umbral fijo
 *      («más oscuro que 128») funciona con una foto y falla con la
 *      siguiente, según la luz que había. Otsu busca el corte que mejor
 *      separa los dos grupos de esta foto en particular.
 *   3. Transparencia gradual en vez de recorte duro: un píxel apenas más
 *      oscuro que el papel queda casi transparente, y el centro del
 *      trazo, opaco. Así el borde no queda dentado.
 *   4. Recorte al trazo, con un margen chico. Sin esto queda todo el
 *      papel alrededor y la firma se ve diminuta en el PDF.
 */

const ANCHO_MAX = 700

// Por debajo de esta opacidad no es tinta, es el grano del papel.
const MIN_ALPHA = 30

/**
 * Dónde busca la firma cuando no hay ninguna guardada todavía: un archivo
 * dejado a mano en public/. Es el atajo para no tener que sacarle una foto
 * de nuevo desde el teléfono.
 *
 * ⚠ Lo que se sirve desde public/ es público de verdad: ese archivo queda
 *   en el repositorio y accesible en tudominio.com/firma.jpeg para
 *   cualquiera. Sirve para cargarla la primera vez; una vez guardada en el
 *   perfil conviene borrarlo.
 */
export const FIRMA_EN_PUBLIC = '/firma.jpeg'

function aGrises(data) {
  const gris = new Uint8ClampedArray(data.length / 4)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // Luminancia percibida: el verde pesa más que el azul para el ojo.
    gris[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0
  }
  return gris
}

/** Umbral de Otsu: el corte que deja los dos grupos lo más separados posible. */
function umbralOtsu(gris) {
  const hist = new Array(256).fill(0)
  for (let i = 0; i < gris.length; i++) hist[gris[i]]++

  const total = gris.length
  let suma = 0
  for (let t = 0; t < 256; t++) suma += t * hist[t]

  let sumaB = 0
  let pesoB = 0
  let mejorVar = -1
  let umbral = 128

  for (let t = 0; t < 256; t++) {
    pesoB += hist[t]
    if (pesoB === 0) continue
    const pesoF = total - pesoB
    if (pesoF === 0) break

    sumaB += t * hist[t]
    const mediaB = sumaB / pesoB
    const mediaF = (suma - sumaB) / pesoF
    const varianza = pesoB * pesoF * (mediaB - mediaF) * (mediaB - mediaF)

    if (varianza > mejorVar) {
      mejorVar = varianza
      umbral = t
    }
  }
  return umbral
}

/**
 * El corazón del asunto, sin nada del navegador: recibe los píxeles RGBA
 * y los deja convertidos en trazo sobre transparente, devolviendo el
 * recuadro que ocupa la firma.
 *
 * Está separado para poder probarlo con una foto de verdad fuera del
 * navegador. Es donde puede salir mal (una foto con sombra, un papel
 * amarillento) y donde no alcanza con que compile.
 *
 * @param {Uint8ClampedArray} data  píxeles RGBA, se modifican en el lugar
 * @returns {{x0:number,y0:number,x1:number,y1:number,umbral:number}}
 */
export function procesarPixeles(data, ancho, alto) {
  const gris = aGrises(data)
  const umbral = umbralOtsu(gris)

  // El trazo más oscuro de la foto marca el extremo opaco de la escala.
  let masOscuro = 255
  for (let i = 0; i < gris.length; i++) if (gris[i] < masOscuro) masOscuro = gris[i]

  // La rampa satura antes de llegar al punto más oscuro (de ahí el 0.55):
  // en una foto, el centro del trazo casi nunca alcanza el negro absoluto,
  // así que repartir la opacidad hasta ese extremo deja toda la firma
  // grisácea y descolorida. Saturando antes, el cuerpo del trazo queda
  // opaco y solo los bordes quedan a media tinta, que es lo que hace que
  // se vea dibujada y no pixelada.
  const rango = Math.max(1, (umbral - masOscuro) * 0.55)

  let x0 = ancho
  let y0 = alto
  let x1 = -1
  let y1 = -1

  for (let j = 0, p = 0; j < gris.length; j++, p += 4) {
    const v = gris[j]

    // Tinta: cuanto más oscuro, más opaco.
    const alpha = v >= umbral ? 0 : Math.min(255, Math.round(((umbral - v) / rango) * 255))

    // Debajo de este piso es grano del papel, no tinta. Sin este corte la
    // firma sale con una nube de puntitos alrededor y, sobre todo, el PNG
    // se vuelve incomprimible: el grano no se repite nunca.
    if (alpha < MIN_ALPHA) {
      // El color va fijo aunque sea transparente. Dejarle el color
      // original de la foto multiplica por diez el peso del archivo: el
      // PNG igual guarda esos bytes, y son todos distintos entre sí.
      data[p] = 0
      data[p + 1] = 0
      data[p + 2] = 0
      data[p + 3] = 0
      continue
    }

    data[p] = 20
    data[p + 1] = 24
    data[p + 2] = 28
    data[p + 3] = alpha

    // Para el recorte solo cuentan los píxeles con cuerpo: si no, una
    // mota de polvo del papel agranda el recuadro y la firma vuelve a
    // quedar chiquita y descentrada.
    if (alpha > 60) {
      const x = j % ancho
      const y = (j / ancho) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }

  return { x0, y0, x1, y1, umbral }
}

/**
 * @param {File|Blob} archivo  la foto de la firma
 * @param {number} [anchoMax]  ancho al que se escala antes de procesar
 * @returns {Promise<string>}  dataURL PNG con fondo transparente
 */
export async function limpiarFirma(archivo, anchoMax = ANCHO_MAX) {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('no se pudo leer la imagen'))
      el.src = url
    })

    const escala = Math.min(1, anchoMax / img.naturalWidth)
    const ancho = Math.max(1, Math.round(img.naturalWidth * escala))
    const alto = Math.max(1, Math.round(img.naturalHeight * escala))

    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, ancho, alto)

    const imagen = ctx.getImageData(0, 0, ancho, alto)
    let { x0, y0, x1, y1 } = procesarPixeles(imagen.data, ancho, alto)

    if (x1 < 0) throw new Error('la foto salió toda clara: no se distingue el trazo')

    ctx.putImageData(imagen, 0, 0)

    const margen = Math.round(Math.max(ancho, alto) * 0.02)
    x0 = Math.max(0, x0 - margen)
    y0 = Math.max(0, y0 - margen)
    x1 = Math.min(ancho - 1, x1 + margen)
    y1 = Math.min(alto - 1, y1 + margen)

    const recorte = document.createElement('canvas')
    recorte.width = x1 - x0 + 1
    recorte.height = y1 - y0 + 1
    recorte
      .getContext('2d')
      .drawImage(canvas, x0, y0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height)

    return recorte.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Igual que limpiarFirma, pero garantizando que el resultado entre en la
 * base sin problemas. Una foto de 12 megapíxeles puede dar un PNG de
 * medio mega, y ese texto después viaja en cada carga de la ficha.
 */
export async function limpiarFirmaAcotada(archivo, maxBytes = 260000) {
  let ancho = ANCHO_MAX
  let dataUrl = await limpiarFirma(archivo, ancho)

  // Tres intentos alcanzan: cada paso baja el ancho un 30% y el peso cae
  // mucho más rápido que eso.
  for (let i = 0; i < 3 && dataUrl.length > maxBytes; i++) {
    ancho = Math.round(ancho * 0.7)
    dataUrl = await limpiarFirma(archivo, ancho)
  }

  if (dataUrl.length > maxBytes) {
    throw new Error('la imagen es demasiado pesada, probá con una foto más chica')
  }
  return dataUrl
}
