import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { formatNumero, formatDate } from './utils'
import { triggerDownload } from './pdf'
import { canalesDe } from './redes'

/**
 * PDF del acuerdo de confidencialidad firmado.
 *
 * Va aparte del PDF de presupuesto a propósito: no comparte ni el
 * encabezado ni la grilla de ítems, y mezclarlos habría dejado los dos
 * llenos de condicionales.
 *
 * Lo que se imprime es la columna `cuerpo` de la fila, no la plantilla
 * de nda.js: el PDF tiene que mostrar el texto que las partes firmaron,
 * aunque la plantilla haya cambiado después.
 */

const LINE = '#111111'
const SOFT = '#555555'

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 46,
    paddingTop: 40,
    paddingBottom: 56,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: LINE,
    lineHeight: 1.5
  },

  encabezado: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  encabezadoTexto: { flex: 1, paddingRight: 12 },
  logo: { width: 110, height: 46, objectFit: 'contain' },
  titulo: { fontSize: 15, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  subtitulo: { fontSize: 8.5, color: SOFT, marginTop: 3 },
  contactos: { fontSize: 8, color: SOFT, marginTop: 4 },
  regla: { borderBottomWidth: 1.2, borderBottomColor: LINE, marginBottom: 16 },

  parrafo: { marginBottom: 8, textAlign: 'justify' },
  clausula: { fontFamily: 'Helvetica-Bold', marginBottom: 1.5 },
  encabezadoDoc: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 14 },

  // ── Firmas ────────────────────────────────────────────────
  firmas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  firmaCaja: { width: '46%' },
  // Alto a propósito: una firma chiquita arriba de una raya larga parece
  // un sello mal pegado. Mide lo mismo esté firmado o no, si no las dos
  // rayas quedan a distinta altura.
  firmaLienzo: { height: 86, justifyContent: 'flex-end' },
  firmaImagen: { height: 82, objectFit: 'contain', objectPosition: 'bottom left' },
  firmaVacia: { fontSize: 7.5, color: '#999999', paddingBottom: 6 },
  firmaLinea: { borderTopWidth: 0.8, borderTopColor: LINE, marginTop: 2, marginBottom: 4 },
  firmaRol: { fontSize: 7, color: SOFT, textTransform: 'uppercase', letterSpacing: 0.6 },
  firmaNombre: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  firmaDato: { fontSize: 7.5, color: SOFT, marginTop: 1 },

  // ── Constancia técnica ────────────────────────────────────
  constancia: {
    marginTop: 26,
    borderWidth: 0.5,
    borderColor: '#BBBBBB',
    padding: 9,
    backgroundColor: '#F7F7F5'
  },
  constanciaTitulo: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4
  },
  constanciaTexto: { fontSize: 7, color: SOFT, lineHeight: 1.45 },
  huella: { fontSize: 6.5, fontFamily: 'Courier', color: SOFT, marginTop: 3 },

  pie: {
    position: 'absolute',
    bottom: 24,
    left: 46,
    right: 46,
    textAlign: 'center',
    fontSize: 7,
    color: '#999999'
  },
  paginado: {
    position: 'absolute',
    bottom: 24,
    right: 46,
    fontSize: 7,
    color: '#999999'
  }
})

// Los títulos de cláusula («PRIMERA — OBJETO.») van en negrita y en su
// propio renglón, como en un contrato de papel: así se puede saltar de
// cláusula en cláusula sin leerlo entero. Se detectan por el guion
// largo, que es lo único que aparece siempre y solo ahí.
function Parrafo({ texto, primero }) {
  if (primero) return <Text style={styles.encabezadoDoc}>{texto}</Text>

  const m = texto.match(/^([^—\n]{3,40}—[^.\n]{3,90}\.)\s*([\s\S]*)$/)
  if (m) {
    return (
      <View>
        {/* minPresenceAhead: si el título entra justo al pie de la hoja
            pero su texto no, el título se va entero a la página
            siguiente. Un encabezado de cláusula huérfano al final de una
            página es la clase de detalle que hace dudar de un contrato. */}
        <Text style={styles.clausula} minPresenceAhead={40}>
          {m[1]}
        </Text>
        <Text style={styles.parrafo}>{m[2]}</Text>
      </View>
    )
  }
  return <Text style={styles.parrafo}>{texto}</Text>
}

function fechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

function Firma({ rol, nombre, doc, imagen, firmadoAt }) {
  return (
    <View style={styles.firmaCaja}>
      <View style={styles.firmaLienzo}>
        {imagen ? (
          <Image src={imagen} style={styles.firmaImagen} />
        ) : (
          <Text style={styles.firmaVacia}>Pendiente de firma</Text>
        )}
      </View>
      <View style={styles.firmaLinea} />
      <Text style={styles.firmaRol}>{rol}</Text>
      <Text style={styles.firmaNombre}>{nombre || '—'}</Text>
      {!!doc && <Text style={styles.firmaDato}>DNI / CUIT: {doc}</Text>}
      {!!firmadoAt && <Text style={styles.firmaDato}>Firmado el {fechaHora(firmadoAt)} hs</Text>}
    </View>
  )
}

function NdaPDF({ nda, profile }) {
  const numero = formatNumero(nda.numero, nda.created_at?.slice(0, 10), 'CONF')
  const parrafos = (nda.cuerpo || '').split(/\n{2,}/).filter((p) => p.trim())

  // Los contactos del emisor en el encabezado: email, teléfono, Instagram,
  // web. El PDF del acuerdo se reenvía y se guarda suelto, así que tiene
  // que poder decir por sí solo cómo encontrar a quien lo emitió. Se
  // arma con la misma lista que la web (canalesDe), para que el Instagram
  // se escriba «@estudio» en los dos lados. El domicilio se saca: ya está
  // en el encabezado del propio acuerdo, dentro del texto firmado.
  //
  // El WhatsApp se omite cuando es el mismo número que el teléfono, que
  // es el caso normal: si no, el encabezado dice dos veces la misma
  // línea con distinto formato («11 5555-4444 · 1155554444») y eso en un
  // documento que se firma queda a desprolijo.
  const soloDigitos = (v) => (v || '').replace(/\D/g, '')
  const telDigitos = soloDigitos(profile?.phone)

  const contactos = canalesDe(profile)
    .filter((c) => c.key !== 'address')
    .filter((c) => !(c.key === 'whatsapp' && telDigitos && soloDigitos(c.valor) === telDigitos))
    .map((c) => c.texto)
    .filter(Boolean)
    .join('  ·  ')

  return (
    <Document title={numero}>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado} fixed={false}>
          <View style={styles.encabezadoTexto}>
            <Text style={styles.titulo}>{numero}</Text>
            <Text style={styles.subtitulo}>
              {profile?.business_name || 'Tu negocio'}
              {profile?.tax_id ? ` · CUIT ${profile.tax_id}` : ''}
            </Text>
            <Text style={styles.subtitulo}>
              Emitido el {formatDate(nda.created_at?.slice(0, 10))}
            </Text>
            {!!contactos && <Text style={styles.contactos}>{contactos}</Text>}
          </View>
          {!!profile?.logo_url && <Image src={profile.logo_url} style={styles.logo} />}
        </View>
        <View style={styles.regla} />

        {parrafos.map((p, i) => (
          <Parrafo key={i} texto={p} primero={i === 0} />
        ))}

        {/* Las dos firmas no se parten entre páginas: media firma en una
            hoja y media en la siguiente no la mira nadie con confianza. */}
        <View style={styles.firmas} wrap={false}>
          <Firma
            rol="Parte A"
            nombre={nda.firma_emisor_nombre || profile?.business_name}
            doc={nda.firma_emisor_doc || profile?.tax_id}
            imagen={nda.firma_emisor}
            firmadoAt={nda.firmado_emisor_at}
          />
          <Firma
            rol="Parte B"
            nombre={nda.firma_parte_nombre || nda.parte_nombre}
            doc={nda.firma_parte_doc || nda.parte_doc}
            imagen={nda.firma_parte}
            firmadoAt={nda.firmado_parte_at}
          />
        </View>

        <View style={styles.constancia} wrap={false}>
          <Text style={styles.constanciaTitulo}>Constancia de firma electrónica</Text>
          <Text style={styles.constanciaTexto}>
            Este documento fue firmado electrónicamente por las partes, cada una desde su propio
            dispositivo, en la fecha y hora indicadas junto a cada firma. La huella digital SHA-256
            que sigue corresponde al texto firmado: cualquier modificación posterior del texto, por
            mínima que sea, da una huella distinta.
          </Text>
          {!!nda.huella && <Text style={styles.huella}>SHA-256: {nda.huella}</Text>}
          <Text style={styles.huella}>Identificador del acuerdo: {nda.id}</Text>
        </View>

        <Text style={styles.pie} fixed>
          {numero} · {profile?.business_name || ''}
        </Text>
        <Text
          style={styles.paginado}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

export async function generateNdaPdfBlob({ nda, profile }) {
  return pdf(<NdaPDF nda={nda} profile={profile} />).toBlob()
}

export async function downloadNdaPdf({ nda, profile }) {
  const blob = await generateNdaPdfBlob({ nda, profile })
  triggerDownload(blob, `${formatNumero(nda.numero, nda.created_at?.slice(0, 10), 'CONF')}.pdf`)
}

export default NdaPDF
