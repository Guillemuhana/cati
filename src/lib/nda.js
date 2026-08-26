/**
 * Acuerdo de confidencialidad (NDA) mutuo, modelo argentino.
 *
 * ⚠ NO ES ASESORAMIENTO LEGAL. Es un modelo estándar razonable, no un
 *   texto revisado por un abogado para un caso concreto. Antes de usarlo
 *   con un cliente importante, que lo lea un profesional.
 *
 * ⚠ POR QUÉ EL TEXTO SE CONGELA AL CREAR EL ACUERDO
 *   Lo que devuelve textoAcuerdo() se guarda ENTERO en la columna
 *   `cuerpo` de la fila, junto con su SHA-256. Si mañana se corrige una
 *   coma acá, los acuerdos ya firmados no cambian: lo que se firmó es lo
 *   que quedó escrito. Un NDA que se reescribe solo no prueba nada.
 */

/**
 * 0 = sin fecha de vencimiento, y es lo que se usa siempre.
 *
 * La app ya no ofrece elegir plazo: un acuerdo que caduca en tres años
 * deja la idea a la intemperie justo cuando el proyecto empieza a valer.
 * El soporte para un plazo en años queda en textoAcuerdo() por si algún
 * día hace falta, pero no hay pantalla que lo pida.
 */
export const VIGENCIA_INDEFINIDA = 0

/** Cómo se dice el plazo en pantalla, fuera del texto legal. */
export function textoVigencia(anios) {
  return Number(anios) > 0 ? `por ${anios} años` : 'sin fecha de vencimiento'
}

export const JURISDICCION_DEFAULT = 'la Ciudad Autónoma de Buenos Aires'

/**
 * Hueco que deja el acuerdo para identificar a la otra parte.
 *
 * ⚠ POR QUÉ EXISTE
 *   El cliente desconfiado no quiere dar ni el nombre antes de saber qué
 *   va a firmar. Así que el acuerdo se manda con este hueco y lo completa
 *   él mismo, en el momento de firmar. Quien firma escribe sus propios
 *   datos: nadie los pone por él.
 *
 * ⚠ QUIÉN LO REEMPLAZA
 *   Lo reemplaza la base, dentro de sign_nda (migración 27), no el
 *   navegador. Si el reemplazo lo hiciera el cliente y mandara el texto
 *   ya armado, cualquiera podría firmar un acuerdo con el cuerpo
 *   cambiado. Acá el navegador solo lo muestra en pantalla mientras
 *   escribe; lo que queda escrito lo arma el servidor.
 */
export const MARCADOR_PARTE = '[[PARTE_B]]'

/**
 * Cómo se identifica una parte dentro del acuerdo.
 *
 * ⚠ Esta regla está escrita DOS VECES: acá y en sign_nda (migración 27).
 *   Tienen que dar exactamente el mismo texto, porque el cliente ve la
 *   versión de acá mientras escribe y firma la que arma la base. Si se
 *   toca una, se toca la otra.
 */
export function identificarParte({ nombre, doc, domicilio } = {}) {
  const partes = [(nombre || '').trim()]
  if ((doc || '').trim()) partes.push(`CUIT/DNI ${doc.trim()}`)
  if ((domicilio || '').trim()) partes.push(`con domicilio en ${domicilio.trim()}`)
  return partes.filter(Boolean).join(', ')
}

function nombrarParte(datos) {
  return identificarParte(datos) || MARCADOR_PARTE
}

/**
 * El cuerpo con el hueco reemplazado, para mostrarlo en pantalla
 * mientras el cliente completa sus datos. Solo para ver: lo que se
 * guarda lo arma la base.
 */
export function completarParte(cuerpo, datos) {
  const ident = identificarParte(datos)
  return (cuerpo || '').split(MARCADOR_PARTE).join(ident || '________________________')
}

/**
 * Arma el texto completo del acuerdo.
 *
 * @param {object} o
 * @param {object} o.emisor   { nombre, doc, domicilio } — tu negocio
 * @param {object} o.parte    { nombre, doc, domicilio } — el cliente
 * @param {string} o.proyecto de qué se va a hablar, en una línea
 * @param {number} o.vigenciaAnios
 * @param {string} o.jurisdiccion
 * @returns {string}
 */
export function textoAcuerdo({
  emisor = {},
  parte = {},
  proyecto = '',
  vigenciaAnios = 3,
  jurisdiccion = JURISDICCION_DEFAULT
} = {}) {
  const objeto =
    (proyecto || '').trim() ||
    'la evaluación de un posible desarrollo de software a medida y de la contratación de los servicios profesionales necesarios para llevarlo adelante'

  // «con motivo de» + «el desarrollo de…» da «de el desarrollo». El
  // placeholder del formulario invita justamente a escribirlo así, con
  // lo cual la falta de ortografía saldría impresa en casi todos los
  // acuerdos. Se contrae acá y no se le pide nada al usuario.
  const conMotivoDe = /^el\s/i.test(objeto)
    ? `del ${objeto.slice(3)}`
    : `de ${objeto}`

  // Sin fecha de corte, que es lo que de verdad tranquiliza a quien va a
  // contar una idea: un acuerdo que vence en tres años deja la idea
  // desprotegida justo cuando el proyecto empieza a valer algo.
  //
  // El plazo indefinido va atado a la cláusula de excepciones: la
  // obligación dura mientras la información siga siendo confidencial. Sin
  // ese matiz sería una obligación eterna incluso sobre algo que ya se
  // hizo público, y eso es lo que un juez recortaría primero.
  const plazo =
    Number(vigenciaAnios) > 0
      ? `Las obligaciones de confidencialidad rigen desde la firma del presente y se mantienen por el plazo de ${vigenciaAnios} ${
          Number(vigenciaAnios) === 1 ? 'año' : 'años'
        }.`
      : 'Las obligaciones de confidencialidad rigen desde la firma del presente y se mantienen sin plazo de vencimiento, mientras la información conserve carácter confidencial conforme a la cláusula CUARTA.'

  return `ACUERDO DE CONFIDENCIALIDAD

Entre ${nombrarParte(emisor)}, en adelante «la Parte A», y ${nombrarParte(
    parte
  )}, en adelante «la Parte B», y en conjunto «las Partes», se celebra el presente Acuerdo de Confidencialidad, que se regirá por las siguientes cláusulas:

PRIMERA — OBJETO. Las Partes se proponen intercambiar información con motivo ${conMotivoDe}. Este acuerdo protege esa información y se firma con carácter previo a cualquier intercambio. Las obligaciones que aquí se asumen son recíprocas: alcanzan a las dos Partes por igual, según cuál revele y cuál reciba la información en cada caso.

SEGUNDA — INFORMACIÓN CONFIDENCIAL. Se considera información confidencial toda aquella que una Parte («la Parte Reveladora») comunique a la otra («la Parte Receptora») con motivo del objeto, en cualquier soporte —oral, escrito, digital, visual o de cualquier otra naturaleza—, incluyendo de manera enunciativa y no taxativa: ideas y conceptos de producto, funcionalidades, prototipos, diseños, código fuente, documentación técnica, modelos y planes de negocio, estrategias comerciales y de marketing, precios y estructura de costos, listados de clientes y proveedores, y todo dato al que la Parte Receptora acceda con motivo de este acuerdo. La información comunicada de forma oral queda protegida desde el momento mismo en que se comunica, sin necesidad de confirmación escrita posterior. También es confidencial la propia existencia y el contenido de las conversaciones entre las Partes.

TERCERA — OBLIGACIONES DE LA PARTE RECEPTORA. La Parte Receptora se obliga a: (a) no divulgar la información confidencial a terceros sin autorización previa y por escrito de la Parte Reveladora; (b) utilizarla exclusivamente para evaluar y, en su caso, ejecutar el objeto de este acuerdo, y para ningún otro fin; (c) protegerla con al menos el mismo grado de cuidado con que protege su propia información confidencial, y en ningún caso con menos que una diligencia razonable; (d) limitar el acceso a aquellos socios, empleados o colaboradores que necesiten conocerla para el objeto de este acuerdo, haciéndoles asumir previamente obligaciones de confidencialidad no menos estrictas que las presentes, y respondiendo por su incumplimiento como si fuera propio; (e) no copiar ni registrar la información más allá de lo necesario para el objeto.

CUARTA — EXCEPCIONES. No se considera información confidencial aquella que: (a) fuera de dominio público al momento de ser revelada, o pasara a serlo con posterioridad sin culpa de la Parte Receptora; (b) la Parte Receptora ya tuviera legítimamente en su poder con anterioridad, y pueda acreditarlo por medios fehacientes; (c) reciba de un tercero que no esté sujeto a obligación de reserva; (d) desarrolle de forma independiente, sin utilizar la información recibida; o (e) deba revelar por imperativo legal o por orden de autoridad judicial o administrativa competente, supuesto en el cual la Parte Receptora deberá notificarlo de inmediato a la Parte Reveladora y limitar la revelación a lo estrictamente exigido.

QUINTA — NO USO EN BENEFICIO PROPIO. La Parte Receptora se obliga a no utilizar la información confidencial recibida para desarrollar, por sí o por interpósita persona, un producto o servicio que reproduzca sustancialmente el proyecto de la Parte Reveladora.

SEXTA — CONOCIMIENTO GENERAL Y ACTIVIDAD PROFESIONAL. Ninguna disposición de este acuerdo restringe el derecho de cualquiera de las Partes a seguir empleando sus conocimientos, técnicas, metodologías, herramientas y experiencia profesional de carácter general, incluidos los que conserve en la memoria, siempre que no incorpore ni divulgue información confidencial de la otra Parte. En particular, y para evitar toda duda, este acuerdo no constituye una cláusula de exclusividad ni de no competencia: cada Parte conserva plena libertad para prestar o contratar servicios con terceros, incluso dentro del mismo rubro o actividad.

SÉPTIMA — PROPIEDAD DEL PROYECTO Y AUSENCIA DE SOCIEDAD. La información confidencial continúa siendo propiedad exclusiva de la Parte Reveladora. Este acuerdo no transfiere ni licencia derecho de propiedad intelectual alguno, no obliga a ninguna de las Partes a revelar información determinada ni a celebrar contrato alguno entre ellas, y no constituye ni supone la intención de constituir sociedad, unión transitoria, emprendimiento conjunto, agencia ni relación asociativa de ninguna especie. En particular, y para evitar toda duda: el proyecto, la idea de negocio y la aplicación o desarrollo que la Parte Reveladora se proponga llevar adelante, junto con sus resultados económicos, le pertenecen en forma exclusiva. La Parte Receptora no adquiere ni reclamará por este acuerdo participación societaria, regalías, comisiones ni porcentaje alguno sobre los ingresos, las ganancias o la valuación del proyecto, y su única retribución será el precio que en su caso se pacte por sus servicios profesionales de desarrollo, mantenimiento, soporte o los que correspondan.

OCTAVA — DEVOLUCIÓN O DESTRUCCIÓN. Concluida la relación entre las Partes, y a simple requerimiento escrito de la Parte Reveladora, la Parte Receptora devolverá o destruirá la información confidencial en su poder. Podrá conservar una copia de archivo al solo efecto de acreditar el cumplimiento de este acuerdo, y aquellas copias que resulten de sus sistemas automáticos de respaldo, que permanecerán sujetas a las obligaciones aquí asumidas mientras subsistan.

NOVENA — PLAZO. ${plazo} Subsisten aun cuando no llegara a celebrarse contrato alguno entre las Partes, aunque el proyecto no se lleve a cabo, y con independencia del motivo por el cual finalicen las conversaciones.

DÉCIMA — INCUMPLIMIENTO. El incumplimiento de las obligaciones aquí asumidas hará responsable a la Parte incumplidora de los daños y perjuicios ocasionados, sin perjuicio de las acciones que correspondan conforme a la Ley 24.766 de Confidencialidad y demás normativa aplicable.

DÉCIMO PRIMERA — FIRMA ELECTRÓNICA. Las Partes acuerdan suscribir el presente por medios electrónicos y reconocen expresamente su validez como manifestación de su consentimiento, en los términos de los artículos 284, 286 y 1106 del Código Civil y Comercial de la Nación y de la Ley 25.506. Cada firma queda registrada con la fecha y hora en que fue prestada y asociada a la huella digital SHA-256 del texto firmado, que se reproduce al pie del documento. Las Partes renuncian a objetar la validez de este acuerdo por el solo hecho de haber sido firmado electrónicamente.

DÉCIMO SEGUNDA — GENERALIDADES. La eventual nulidad de alguna cláusula no afecta la validez de las restantes. La tolerancia de una Parte frente al incumplimiento de la otra no importa renuncia a sus derechos. Este acuerdo constituye el entendimiento íntegro entre las Partes sobre la materia y solo puede modificarse por escrito.

DÉCIMO TERCERA — LEY APLICABLE Y JURISDICCIÓN. Este acuerdo se rige por las leyes de la República Argentina. Para toda controversia derivada del presente, las Partes se someten a la jurisdicción de los tribunales ordinarios de ${jurisdiccion}, con renuncia a cualquier otro fuero o jurisdicción que pudiera corresponder.

En prueba de conformidad, las Partes suscriben el presente acuerdo en la fecha que consta junto a cada firma.`
}

/**
 * Huella SHA-256 del texto, en hexadecimal y en grupos de a 8 para que
 * se pueda leer y comparar a ojo en el PDF.
 *
 * Es el ancla del documento: si alguien cambia una letra de lo firmado,
 * la huella deja de coincidir. Se calcula con la Web Crypto del propio
 * navegador, que solo está disponible en https (o en localhost).
 */
export async function huellaDe(texto) {
  try {
    const datos = new TextEncoder().encode(texto)
    const buf = await crypto.subtle.digest('SHA-256', datos)
    const hex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return hex.match(/.{1,8}/g).join(' ')
  } catch {
    // Sin crypto.subtle (http sin certificado) el acuerdo se guarda igual,
    // solo que sin huella. Es un extra, no un requisito.
    return ''
  }
}

/**
 * Etiquetas de estado. Los colores son los mismos nombres que usa STATUS
 * en utils.js, para que el badge de acá se pinte con el mapa que ya
 * existe en StatusBadge.
 */
export const NDA_STATUS = {
  pendiente: { label: 'Falta firmar', color: 'brass' },
  firmado: { label: 'Firmado', color: 'teal' },
  anulado: { label: 'Anulado', color: 'ink' }
}

/**
 * Qué falta para que el acuerdo esté cerrado. Se usa para el cartel de
 * la ficha y para el badge de la lista.
 */
export function faltaFirma(nda) {
  if (!nda) return null
  if (nda.status === 'anulado') return null
  if (!nda.firmado_emisor_at) return 'emisor'
  if (!nda.firmado_parte_at) return 'parte'
  return null
}
