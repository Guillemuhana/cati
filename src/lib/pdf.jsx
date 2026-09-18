import { Document, Page, Text, View, StyleSheet, Image, Font, Svg, Path, pdf } from '@react-pdf/renderer'
// El PDF se arma fuera de React (desde un botón, no desde un componente),
// así que el idioma se lee de la instancia y no del hook.
import i18n from '../i18n'
import {
  formatMoney,
  formatDate,
  formatNumero,
  STATUS,
  safeImages,
  isSafeImageUrl,
  sinTituloRepetido,
  resumenDePagos
} from './utils'
import { plantillaDe } from './plantillas'
import QRCode from 'qrcode'
import { cleanDetails } from '../components/BudgetDetails'
import { canalesDe } from './redes'

// Fuentes: usamos Helvetica (nativa de react-pdf) para asegurar que el PDF
// se genere sin depender de carga de red en tiempo de export.
//
// Diseño: comprobante comercial clásico argentino — todo en recuadros.
//   ┌ logo │ datos del emisor │ X │ PRESUPUESTO N° / FECHA ┐
//   ├ datos del cliente (dos columnas) ──────────────────────┤
//   ├ entrega / observaciones ───────────────────────────────┤
//   ├ tabla de ítems con encabezado gris ────────────────────┤
//                                    └ caja de totales ──────┘
const LINE = '#111111'
const SOFT = '#555555'

// A4 en puntos, que es la unidad de react-pdf.
const A4_ANCHO = 595.28
const A4_ALTO = 841.89
const MARGEN = 28

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: MARGEN,
    paddingTop: MARGEN,
    paddingBottom: 56,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: LINE
  },

  // ── Encabezado ────────────────────────────────────────────
  headerBox: { flexDirection: 'row', borderWidth: 1, borderColor: LINE },
  headerLogoCell: {
    width: 150,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: LINE
  },
  logo: { width: 134, height: 62, objectFit: 'contain' },

  // Imágenes que el usuario adjuntó al presupuesto (opcionales)
  imagesBlock: { marginTop: 10 },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  budgetImage: {
    width: 124,
    height: 92,
    objectFit: 'cover',
    borderWidth: 1,
    borderColor: LINE,
    marginRight: 6,
    marginBottom: 6
  },

  // Contacto y redes del emisor, arriba de la firma
  contactRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 3 },
  contactText: { fontSize: 8, color: '#333333', marginLeft: 3 },

  logoFallback: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  headerEmitterCell: { flex: 1, padding: 8, justifyContent: 'center', alignItems: 'center' },
  businessName: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  emitterLine: { fontSize: 8, color: SOFT, textAlign: 'center', marginTop: 2 },
  headerTypeCell: {
    width: 46,
    borderLeftWidth: 1,
    borderLeftColor: LINE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  typeLetter: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 1
  },
  headerDocCell: { width: 190, padding: 8, justifyContent: 'center' },
  docTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  docNumber: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  docDate: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginTop: 2 },
  docFiscal: { fontSize: 6.5, color: SOFT, textAlign: 'right', marginTop: 3 },

  // ── Bloques de datos ──────────────────────────────────────
  dataBox: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: LINE,
    paddingHorizontal: 6,
    paddingVertical: 5,
    flexDirection: 'row'
  },
  dataCol: { width: '50%', paddingRight: 8 },
  // Cuando el cliente tiene logo, las dos columnas se reparten lo que
  // sobra en vez de ocupar la mitad justa cada una.
  dataColConLogo: { flex: 1, paddingRight: 8 },
  // El logo del cliente va al lado de sus datos y bien más chico que el
  // nuestro (134x62): la hoja la manda el que presupuesta, no el que la
  // recibe.
  clientLogoCell: {
    width: 78,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: LINE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clientLogo: { width: 66, height: 30, objectFit: 'contain' },
  fieldRow: { flexDirection: 'row', marginBottom: 2 },
  fieldLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  fieldValue: { fontSize: 8, flex: 1 },

  // ── Tabla de ítems ────────────────────────────────────────
  table: { marginTop: 10, borderWidth: 1, borderColor: LINE },
  tableHeader: { flexDirection: 'row', backgroundColor: '#DDDDDD', borderBottomWidth: 1, borderBottomColor: LINE },
  th: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderRightColor: LINE
  },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  td: { fontSize: 8, paddingVertical: 3.5, paddingHorizontal: 3, borderRightWidth: 0.5, borderRightColor: '#999999' },
  lastCell: { borderRightWidth: 0 },
  colDesc: { flex: 3.6 },
  colQty: { width: 55, textAlign: 'right' },
  colPrice: { width: 70, textAlign: 'right' },
  colDisc: { width: 42, textAlign: 'right' },
  colTotal: { width: 80, textAlign: 'right' },

  // ── Pagos ya cobrados ─────────────────────────────────────
  // Debajo de los totales: cuando el cliente pregunta «cuánto falta»,
  // esto es la respuesta y tiene que estar en el papel, no en un chat.
  pagosBox: {
    marginTop: 10,
    alignSelf: 'flex-end',
    minWidth: 240,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  pagosTitulo: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  pagosRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1.5 },
  pagosLabel: { fontSize: 8, color: SOFT },
  pagosLabelCobrado: { fontSize: 8, color: LINE },
  pagosValue: { fontSize: 8 },
  pagosFaltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.8,
    borderTopColor: LINE
  },
  pagosFaltaLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  // Debajo de la caja de totales, alineada con ella: qué pasa cuando la
  // seña se paga. Es la pregunta que el cliente hace por WhatsApp apenas
  // lee el número, así que mejor que esté escrita en el papel.
  depositNote: {
    marginTop: 5,
    alignSelf: 'flex-end',
    maxWidth: 260,
    fontSize: 8,
    color: SOFT,
    textAlign: 'right',
    fontFamily: 'Helvetica-Oblique'
  },

  // ── Totales ───────────────────────────────────────────────
  totalsBox: {
    marginTop: 10,
    alignSelf: 'flex-end',
    width: 250,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
  totalsLabel: { fontSize: 8.5 },
  totalsValue: { fontSize: 8.5 },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#999999'
  },
  grandTotalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold' },

  // ── Pie de página ─────────────────────────────────────────
  notesBlock: { marginTop: 14 },
  notesTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  notesText: { fontSize: 8, color: '#333333', lineHeight: 1.45 },
  legalBlock: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: '#DDDDDD', paddingTop: 8 },
  legalTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: SOFT, letterSpacing: 0.5, marginBottom: 3 },
  legalText: { fontSize: 6.5, color: SOFT, lineHeight: 1.4, textAlign: 'justify' },
  payGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap' },
  payCol: { width: '50%', paddingRight: 12, marginBottom: 8 },
  signRow: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },

  // El QR para abrirlo online. Va antes de las firmas y pegado al
  // margen izquierdo: si fuera arriba pelearía con el número y el
  // logo, que es donde el cliente busca de qué documento se trata.
  //
  // El ancho va FIJO y no con alignSelf + maxWidth. Con eso la caja se
  // encogía al contenido, el flex:1 del texto no tenía ancho que
  // repartir, y la explicación salía en una columna de una palabra,
  // cortada con guiones letra por letra. Se ve feo y encima deja el
  // documento con pinta de roto.
  qrBox: {
    marginTop: 14,
    width: 272,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: LINE,
    paddingVertical: 6,
    paddingHorizontal: 7
  },
  // 64 puntos son unos 22 mm impresos. Más chico entra en el terreno
  // donde una cámara vieja o una impresora con poco tóner ya no lo
  // levantan, y eso se descubre con el papel en la mano del cliente.
  qrImg: { width: 64, height: 64 },
  // 272 menos el borde (2), el relleno (14), el QR (64) y su margen (8).
  // Escrito y no calculado con flex, por lo mismo de arriba.
  qrTextos: { marginLeft: 8, width: 184 },
  qrTitulo: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  qrBajada: { fontSize: 7, color: SOFT, marginTop: 1.5, lineHeight: 1.3 },
  signBox: { width: '45%' },
  signLine: { borderTopWidth: 0.8, borderTopColor: '#999999', marginBottom: 3, marginTop: 22 },
  signLabel: { fontSize: 7.5, color: SOFT },
  // El hueco de arriba de la raya. Mide siempre lo mismo haya firma o no:
  // si no, las dos rayas quedan a distinta altura y se nota. Es alto a
  // propósito: una firma chiquita arriba de una raya larga parece un
  // sello mal pegado, y al cliente le tiene que quedar lugar para firmar
  // a mano del otro lado.
  signCanvas: { height: 72, justifyContent: 'flex-end' },
  signImage: { height: 68, objectFit: 'contain', objectPosition: 'bottom left' },
  signLineFirma: { borderTopWidth: 0.8, borderTopColor: '#999999', marginTop: 2, marginBottom: 3 },
  signName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  signRole: { fontSize: 8, color: SOFT, marginBottom: 1 },
  // La hoja membretada de la plantilla, cuando hay una.
  //
  // Hijo directo de Page y absoluto: react-pdf lo mide desde el borde
  // del papel, no desde adentro del padding, así que 0,0 más el tamaño
  // completo de A4 la deja a sangre. (Descontarle el margen la corre
  // fuera de la hoja: sale 28 puntos a la izquierda y 28 abajo.)
  //
  // Va como PRIMER hijo de la página y con `fixed`: primero para que el
  // texto se dibuje encima, fixed para que se repita en la hoja 2 y 3
  // de un presupuesto largo.
  fondoPlantilla: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: A4_ANCHO,
    height: A4_ALTO
  },

  footer: {
    position: 'absolute',
    bottom: 26,
    left: 28,
    right: 28,
    fontSize: 7.5,
    color: SOFT,
    textAlign: 'center'
  }
})

// Los ítems de una factura salen de una columna jsonb (snapshot), así que
// pueden llegar como array, como string JSON o como null. Los de un
// presupuesto salen de una tabla. Normalizamos para no romper el .map().
function normalizeItems(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

// Campo "ETIQUETA: valor" dentro de los recuadros de datos.
// Se muestra siempre (aunque esté vacío) cuando `always` es true, igual que
// los comprobantes impresos, donde el renglón queda en blanco.
// lucide dibuja con varios trazos (líneas, círculos) y el PDF necesita un
// path solo, así que para los cuatro datos de siempre usamos una silueta
// equivalente, en la misma caja de 24×24.
const SILUETAS = {
  phone:
    'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  email:
    'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  address:
    'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z',
  website:
    'M12 2a10 10 0 100 20 10 10 0 000-20zm6.93 6h-2.95a15.65 15.65 0 00-1.38-3.56A8.03 8.03 0 0118.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a7.9 7.9 0 010-4h3.38a16.5 16.5 0 000 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 015.07 16zm2.95-8H5.07a7.99 7.99 0 014.33-3.56A15.65 15.65 0 008.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66a14.72 14.72 0 010-4h4.68a14.72 14.72 0 010 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 01-4.33 3.56zM16.36 14a16.5 16.5 0 000-4h3.38a7.9 7.9 0 010 4h-3.38z'
}

function Field({ label, value, always = false }) {
  // Si el usuario encabezó su texto con el mismo rótulo, se saca: si no
  // sale «CONDICION DE PAGO: Condiciones de pago:» y queda de amateur.
  const texto = sinTituloRepetido(value, label)
  if (!texto && !always) return null
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}: </Text>
      <Text style={styles.fieldValue}>{texto || ''}</Text>
    </View>
  )
}

// Un renglón para firmar. Si el dueño ya guardó su firma, el presupuesto
// sale firmado; el del cliente siempre va vacío, que para eso lo imprime.
function SignBox({ firma, nombre, cargo, label }) {
  return (
    <View style={styles.signBox}>
      <View style={styles.signCanvas}>
        {!!firma && <Image src={firma} style={styles.signImage} />}
      </View>
      <View style={styles.signLineFirma} />
      {!!nombre && <Text style={styles.signName}>{nombre}</Text>}
      {!!cargo && <Text style={styles.signRole}>{cargo}</Text>}
      <Text style={styles.signLabel}>{label}</Text>
    </View>
  )
}

/**
 * La hoja membretada, si el perfil tiene una plantilla.
 *
 * Las imágenes ya vienen aguadas del archivo (18% sobre blanco) en vez
 * de bajarles la opacidad acá: así se ven igual en cualquier visor de
 * PDF y pesan unos 30 KB en lugar del megabyte del original.
 */
function FondoDePlantilla({ profile }) {
  const { fondo } = plantillaDe(profile)
  if (!fondo) return null
  return <Image src={fondo} style={styles.fondoPlantilla} fixed />
}

function PayCol({ title, text }) {
  const texto = sinTituloRepetido(text, title)
  if (!texto) return null
  return (
    <View style={styles.payCol}>
      <Text style={styles.notesTitle}>{title}</Text>
      <Text style={styles.notesText}>{texto}</Text>
    </View>
  )
}

function PresupuestoPDF({
  budget,
  items,
  client,
  profile,
  docLabel = 'Presupuesto',
  numberPrefix,
  statusText,
  qr,
  // Los cobros que YA entraron, con su fecha y su número de recibo.
  // Los manda la factura; el presupuesto no tiene, porque ahí los pagos
  // son etapas previstas y no plata recibida.
  cobros = []
}) {
  const statusLabel = statusText || i18n.t((STATUS[budget.status] || STATUS.enviado).label)
  const accent = profile?.brand_color || '#1B3B6F'
  const numero = formatNumero(budget.numero, budget.issue_date, numberPrefix || profile?.number_prefix)
  const rows = normalizeItems(items)
  const qtyTotal = rows.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
  // Las etapas de pago (migración 32). El comprobante NO se imprime:
  // acá va lo que se debe, no el resguardo bancario del cliente.
  const pagos = resumenDePagos(budget.pagos, budget.total)
  // Solo del Storage nuestro: si la URL no es de ahí, el PDF sale sin el
  // logo en vez de romperse entero al no poder bajar la imagen.
  const logoCliente = isSafeImageUrl(client?.logo_url) ? client.logo_url : ''
  // La firma guardada en el perfil (migración 27). Viene como data URL, no
  // como enlace: no sale a la red al armar el PDF y no viaja en ningún RPC
  // público. Si no hay firma guardada, queda el renglón en blanco de siempre.
  const firmaPropia = typeof profile?.firma_png === 'string' && profile.firma_png.startsWith('data:image/')
    ? profile.firma_png
    : ''

  return (
    <Document title={`${numero} - ${budget.title || client?.name || ''}`}>
      <Page size="A4" style={styles.page}>
        <FondoDePlantilla profile={profile} />
        {/* Encabezado: logo | emisor | tipo | número y fecha */}
        <View style={styles.headerBox}>
          <View style={styles.headerLogoCell}>
            {profile?.logo_url ? (
              <Image src={profile.logo_url} style={styles.logo} />
            ) : (
              <Text style={styles.logoFallback}>{profile?.business_name || 'Tu negocio'}</Text>
            )}
          </View>
          <View style={styles.headerEmitterCell}>
            <Text style={styles.businessName}>{(profile?.business_name || 'Tu negocio').toUpperCase()}</Text>
            {!!profile?.address && <Text style={styles.emitterLine}>{profile.address}</Text>}
            {!!profile?.phone && <Text style={styles.emitterLine}>TEL: {profile.phone}</Text>}
            {!!profile?.email && <Text style={styles.emitterLine}>{profile.email}</Text>}
          </View>
          <View style={styles.headerTypeCell}>
            <Text style={styles.typeLetter}>X</Text>
          </View>
          <View style={styles.headerDocCell}>
            <Text style={[styles.docTitle, { color: accent }]}>{docLabel.toUpperCase()}</Text>
            <Text style={styles.docNumber}>N° {numero}</Text>
            <Text style={styles.docDate}>FECHA: {formatDate(budget.issue_date)}</Text>
            {!!profile?.tax_id && <Text style={styles.docFiscal}>CUIT: {profile.tax_id}</Text>}
            <Text style={styles.docFiscal}>{statusLabel.toUpperCase()}</Text>
          </View>
        </View>

        {/* Datos del cliente, con su logo al costado si lo cargó */}
        <View style={styles.dataBox}>
          <View style={logoCliente ? styles.dataColConLogo : styles.dataCol}>
            <Field label="SEÑOR/ES" value={client?.name || 'Cliente sin asignar'} />
            <Field label="DOMICILIO" value={client?.address} always />
            <Field label="CORREO ELECTRONICO" value={client?.email} always />
            <Field label="CONDICION DE PAGO" value={budget.payment_terms} always />
          </View>
          <View style={logoCliente ? styles.dataColConLogo : styles.dataCol}>
            <Field label="CUIT / CUIL" value={client?.tax_id} always />
            <Field label="TELEFONO" value={client?.phone} always />
            <Field label="FECHA VENCIMIENTO" value={budget.due_date ? formatDate(budget.due_date) : ''} always />
            <Field label="REFERENCIA" value={budget.reference} always />
          </View>
          {!!logoCliente && (
            <View style={styles.clientLogoCell}>
              <Image src={logoCliente} style={styles.clientLogo} />
            </View>
          )}
        </View>

        {/* Datos del trabajo (los que cargó el usuario, si cargó alguno) */}
        {cleanDetails(budget.details).length > 0 && (
          <View style={styles.dataBox} wrap={false}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
              {cleanDetails(budget.details).map((d) => (
                <View key={d.label} style={styles.dataCol}>
                  <Field label={d.label.toUpperCase()} value={d.value} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Entrega y observaciones */}
        <View style={[styles.dataBox, { flexDirection: 'column' }]}>
          <View style={{ flexDirection: 'row' }}>
            <View style={styles.dataCol}>
              <Field label="PLAZO DE ENTREGA" value={budget.delivery_time} always />
            </View>
            <View style={styles.dataCol}>
              <Field label="FORMAS DE PAGO" value={budget.payment_methods} always />
            </View>
          </View>
          <Field label="OBSERVACIONES" value={budget.title} always />
        </View>

        {/* Detalle de ítems */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDesc]}>Descripcion</Text>
            <Text style={[styles.th, styles.colQty]}>Cant.</Text>
            <Text style={[styles.th, styles.colPrice]}>Precio Uni.</Text>
            <Text style={[styles.th, styles.colDisc]}>% Desc</Text>
            <Text style={[styles.th, styles.colTotal, styles.lastCell]}>Sub Total</Text>
          </View>
          {rows.map((it, i) => {
            const lineBase = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
            const lineTotal = lineBase - lineBase * ((Number(it.discount) || 0) / 100)
            return (
              <View key={it.id ?? i} style={styles.tr}>
                <Text style={[styles.td, styles.colDesc]}>{it.description}</Text>
                <Text style={[styles.td, styles.colQty]}>{it.quantity}</Text>
                <Text style={[styles.td, styles.colPrice]}>{formatMoney(it.unit_price, budget.currency)}</Text>
                <Text style={[styles.td, styles.colDisc]}>{Number(it.discount) || 0}</Text>
                <Text style={[styles.td, styles.colTotal, styles.lastCell]}>
                  {formatMoney(lineTotal, budget.currency)}
                </Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totalsBox} wrap={false}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>CTD ITEMS:</Text>
            <Text style={styles.totalsValue}>{qtyTotal}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>SUBTOTAL:</Text>
            <Text style={styles.totalsValue}>{formatMoney(budget.subtotal, budget.currency)}</Text>
          </View>
          {budget.discount_amount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>DESCUENTO:</Text>
              <Text style={styles.totalsValue}>-{formatMoney(budget.discount_amount, budget.currency)}</Text>
            </View>
          )}
          {budget.tax_amount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>IVA ({budget.tax_rate}%):</Text>
              <Text style={styles.totalsValue}>{formatMoney(budget.tax_amount, budget.currency)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL:</Text>
            <Text style={[styles.grandTotalValue, { color: accent }]}>{formatMoney(budget.total, budget.currency)}</Text>
          </View>
          {Number(budget.deposit) > 0 && (
            <>
              <View style={[styles.totalsRow, { marginTop: 3 }]}>
                <Text style={styles.totalsLabel}>ANTICIPO / SEÑA:</Text>
                <Text style={styles.totalsValue}>-{formatMoney(budget.deposit, budget.currency)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { fontFamily: 'Helvetica-Bold' }]}>SALDO PENDIENTE:</Text>
                <Text style={[styles.totalsValue, { fontFamily: 'Helvetica-Bold' }]}>
                  {formatMoney((Number(budget.total) || 0) - (Number(budget.deposit) || 0), budget.currency)}
                </Text>
              </View>
            </>
          )}
        </View>

        {Number(budget.deposit) > 0 && (
          <Text style={styles.depositNote}>
            El trabajo comienza una vez recibida la seña.
          </Text>
        )}

        {/*
          Lo que el cliente ya pagó, con la fecha de cada entrega.
          Va en la factura: ahí «pagos» es plata que entró, no etapas
          previstas. Es la respuesta a «cuánto llevo pagado» sin tener
          que buscar los recibos sueltos.
        */}
        {cobros.length > 0 && (
          <View style={styles.pagosBox} wrap={false}>
            <Text style={styles.pagosTitulo}>PAGOS RECIBIDOS</Text>
            {cobros.map((c, i) => (
              <View key={i} style={styles.pagosRow}>
                <Text style={styles.pagosLabelCobrado}>
                  {'✓ '}
                  {c.fecha ? formatDate(c.fecha) : ''}
                  {c.numero ? `  ·  Recibo N° ${c.numero}` : ''}
                  {c.metodo ? `  ·  ${c.metodo}` : ''}
                </Text>
                <Text style={styles.pagosValue}>{formatMoney(c.monto, budget.currency)}</Text>
              </View>
            ))}
            <View style={styles.pagosRow}>
              <Text style={styles.pagosLabel}>Total pagado</Text>
              <Text style={styles.pagosValue}>
                {formatMoney(
                  cobros.reduce((acc, c) => acc + (Number(c.monto) || 0), 0),
                  budget.currency
                )}
              </Text>
            </View>
            <View style={styles.pagosFaltaRow}>
              <Text style={styles.pagosFaltaLabel}>SALDO PENDIENTE:</Text>
              <Text style={styles.pagosFaltaLabel}>
                {formatMoney(
                  Math.max(
                    0,
                    (Number(budget.total) || 0) -
                      cobros.reduce((acc, c) => acc + (Number(c.monto) || 0), 0)
                  ),
                  budget.currency
                )}
              </Text>
            </View>
          </View>
        )}

        {pagos.etapas.length > 0 && (
          <View style={styles.pagosBox} wrap={false}>
            <Text style={styles.pagosTitulo}>PAGOS</Text>
            {pagos.etapas.map((p, i) => (
              <View key={i} style={styles.pagosRow}>
                <Text style={p.paid_at ? styles.pagosLabelCobrado : styles.pagosLabel}>
                  {p.paid_at ? '✓ ' : ''}
                  {p.label}
                  {p.percent ? ` (${p.percent}%)` : ''}
                </Text>
                <Text style={styles.pagosValue}>{formatMoney(p.amount, budget.currency)}</Text>
              </View>
            ))}
            <View style={styles.pagosFaltaRow}>
              <Text style={styles.pagosFaltaLabel}>FALTA PAGAR:</Text>
              <Text style={styles.pagosFaltaLabel}>{formatMoney(pagos.falta, budget.currency)}</Text>
            </View>
          </View>
        )}

        {/* Condiciones, formas de pago y plazo ya van en los recuadros de arriba. */}
        {!!profile?.bank_alias && (
          <View style={styles.payGrid} wrap={false}>
            <PayCol title="Datos bancarios / alias" text={profile.bank_alias} />
          </View>
        )}

        {(budget.notes || budget.terms) && (
          <View style={styles.notesBlock} wrap={false}>
            {budget.notes && (
              <>
                <Text style={styles.notesTitle}>Notas</Text>
                <Text style={styles.notesText}>{sinTituloRepetido(budget.notes, 'Notas')}</Text>
              </>
            )}
            {budget.terms && (
              <>
                <Text style={[styles.notesTitle, { marginTop: 12 }]}>Condiciones</Text>
                <Text style={styles.notesText}>{sinTituloRepetido(budget.terms, 'Condiciones')}</Text>
              </>
            )}
          </View>
        )}

        {/* Contacto y redes: cada ícono se dibuja con su trazo */}
        {canalesDe(profile).length > 0 && (
          <View style={styles.contactRow} wrap={false}>
            {canalesDe(profile).map((c) => (
              <View key={c.key} style={styles.contactItem}>
                <Svg width={8} height={8} viewBox="0 0 24 24">
                  <Path d={c.path || SILUETAS[c.key]} fill={c.color || '#555555'} />
                </Svg>
                <Text style={styles.contactText}>{c.texto}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Imágenes del presupuesto (opcionales) */}
        {safeImages(budget.images).length > 0 && (
          <View style={styles.imagesBlock} wrap={false}>
            <Text style={styles.notesTitle}>Imágenes</Text>
            <View style={[styles.imagesRow, { marginTop: 4 }]}>
              {safeImages(budget.images).slice(0, 4).map((url) => (
                <Image key={url} src={url} style={styles.budgetImage} />
              ))}
            </View>
          </View>
        )}

        {/* Las firmas no se parten entre páginas */}
        {/* Se dibuja solo si quien generó el PDF pasó el enlace. Un QR
            que lleva a una página caída es peor que no tener QR: queda
            impreso en un papel que el cliente guarda. */}
        {qr ? (
          <View style={styles.qrBox} wrap={false}>
            <Image src={qr} style={styles.qrImg} />
            <View style={styles.qrTextos}>
              <Text style={styles.qrTitulo}>Velo online</Text>
              <Text style={styles.qrBajada}>
                Escaneá el código con la cámara del celular para abrirlo, descargarlo en PDF y responder.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.signRow} wrap={false}>
          <SignBox label="Firma y aclaración del cliente" />
          <SignBox
            firma={firmaPropia}
            nombre={profile?.firma_nombre}
            cargo={profile?.firma_cargo}
            label={`Por ${profile?.business_name || 'la empresa'}`}
          />
        </View>

        {/* Términos y condiciones del negocio (opcionales, se cargan en Mi negocio) */}
        {!!profile?.legal_terms?.trim() && (
          <View style={styles.legalBlock}>
            <Text style={styles.legalTitle}>TÉRMINOS Y CONDICIONES</Text>
            <Text style={styles.legalText}>{profile.legal_terms.trim()}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          {profile?.business_name || ''}{profile?.hide_branding ? '' : ' · Generado con Numera'}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * El QR del enlace, como imagen para meter en el PDF.
 *
 * Negro y con un margen mínimo: un QR de color o sin borde blanco es
 * el que después no lee la cámara de un teléfono viejo, y eso se
 * descubre cuando el presupuesto ya está impreso.
 *
 * Si falla, devuelve vacío y el PDF sale sin el recuadro. Nunca tira:
 * el presupuesto tiene que poder generarse igual.
 */
async function qrDelEnlace(publicUrl) {
  if (!publicUrl) return ''
  try {
    return await QRCode.toDataURL(publicUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' }
    })
  } catch {
    return ''
  }
}

export async function generateBudgetPdfBlob({ budget, items, client, profile, publicUrl }) {
  const qr = await qrDelEnlace(publicUrl)
  const doc = <PresupuestoPDF budget={budget} items={items} client={client} profile={profile} qr={qr} />
  const instance = pdf(doc)
  return instance.toBlob()
}

export async function downloadBudgetPdf({ budget, items, client, profile, publicUrl }) {
  const blob = await generateBudgetPdfBlob({ budget, items, client, profile, publicUrl })
  triggerDownload(blob, `${formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)}.pdf`)
}

// ── Factura / comprobante (no fiscal) ──────────────────────────
const INVOICE_STATUS = { emitida: 'facturas.emitida', pagada: 'facturas.pagada', anulada: 'facturas.anulada' }

export async function generateInvoicePdfBlob({ invoice, client, profile, publicUrl, receipts = [] }) {
  const qr = await qrDelEnlace(publicUrl)

  // Los recibos, ordenados por fecha de cobro.
  //
  // No hay filtro por estado porque los recibos no se anulan: se
  // borran (tabla receipts, migración 06). El que está, entró.
  const cobros = (receipts || [])
    .filter((r) => r && Number(r.amount) > 0)
    .sort((a, b) => String(a.receipt_date || a.created_at).localeCompare(String(b.receipt_date || b.created_at)))
    .map((r) => ({
      fecha: r.receipt_date || r.created_at,
      numero: r.numero,
      metodo: r.method || '',
      monto: Number(r.amount) || 0
    }))
  const doc = (
    <PresupuestoPDF
      budget={invoice}
      items={invoice.items || []}
      client={client}
      profile={profile}
      docLabel="Comprobante"
      numberPrefix="FAC"
      statusText={i18n.t(INVOICE_STATUS[invoice.status] || 'facturas.emitida')}
      qr={qr}
      cobros={cobros}
    />
  )
  return pdf(doc).toBlob()
}

export async function downloadInvoicePdf({ invoice, client, profile, publicUrl, receipts }) {
  const blob = await generateInvoicePdfBlob({ invoice, client, profile, publicUrl, receipts })
  triggerDownload(blob, `${formatNumero(invoice.numero, invoice.issue_date, 'FAC')}.pdf`)
}

// ── Recibo de pago / seña ──────────────────────────────────────
function ReciboPDF({ receipt, client, profile }) {
  const accent = profile?.brand_color || '#1B3B6F'
  const numero = formatNumero(receipt.numero, receipt.receipt_date, 'REC')
  return (
    <Document title={numero}>
      <Page size="A4" style={styles.page}>
        <FondoDePlantilla profile={profile} />
        <View style={styles.headerBox}>
          <View style={styles.headerLogoCell}>
            {profile?.logo_url ? (
              <Image src={profile.logo_url} style={styles.logo} />
            ) : (
              <Text style={styles.logoFallback}>{profile?.business_name || 'Tu negocio'}</Text>
            )}
          </View>
          <View style={styles.headerEmitterCell}>
            <Text style={styles.businessName}>{(profile?.business_name || 'Tu negocio').toUpperCase()}</Text>
            {!!profile?.address && <Text style={styles.emitterLine}>{profile.address}</Text>}
            {!!profile?.phone && <Text style={styles.emitterLine}>TEL: {profile.phone}</Text>}
            {!!profile?.email && <Text style={styles.emitterLine}>{profile.email}</Text>}
          </View>
          <View style={styles.headerTypeCell}>
            <Text style={styles.typeLetter}>X</Text>
          </View>
          <View style={styles.headerDocCell}>
            <Text style={[styles.docTitle, { color: accent }]}>RECIBO</Text>
            <Text style={styles.docNumber}>N° {numero}</Text>
            <Text style={styles.docDate}>FECHA: {formatDate(receipt.receipt_date)}</Text>
            {!!profile?.tax_id && <Text style={styles.docFiscal}>CUIT: {profile.tax_id}</Text>}
          </View>
        </View>

        <View style={styles.dataBox}>
          <View style={styles.dataCol}>
            <Field label="RECIBIMOS DE" value={client?.name || 'Cliente'} />
            <Field label="DOMICILIO" value={client?.address} always />
          </View>
          <View style={styles.dataCol}>
            <Field label="CUIT / CUIL" value={client?.tax_id} always />
            <Field label="TELEFONO" value={client?.phone} always />
          </View>
        </View>

        <View style={{ marginTop: 12, padding: 14, borderWidth: 1, borderColor: LINE }}>
          <Text style={styles.notesTitle}>LA SUMA DE</Text>
          <Text style={[styles.grandTotalValue, { color: accent, fontSize: 20, marginTop: 2 }]}>
            {formatMoney(receipt.amount, receipt.currency)}
          </Text>
          {!!receipt.concept && (
            <>
              <Text style={[styles.notesTitle, { marginTop: 12 }]}>EN CONCEPTO DE</Text>
              <Text style={styles.notesText}>{receipt.concept}</Text>
            </>
          )}
          {!!receipt.method && (
            <>
              <Text style={[styles.notesTitle, { marginTop: 12 }]}>FORMA DE PAGO</Text>
              <Text style={styles.notesText}>{receipt.method}</Text>
            </>
          )}
        </View>

        <View style={styles.signRow} wrap={false}>
          <View style={styles.signBox}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Firma y aclaración</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {profile?.business_name || ''}{profile?.hide_branding ? '' : ' · Generado con Numera'}
        </Text>
      </Page>
    </Document>
  )
}

export async function downloadReceiptPdf({ receipt, client, profile }) {
  const blob = await pdf(<ReciboPDF receipt={receipt} client={client} profile={profile} />).toBlob()
  triggerDownload(blob, `${formatNumero(receipt.numero, receipt.receipt_date, 'REC')}.pdf`)
}

// La usa también el PDF del acuerdo de confidencialidad (pdfNda.jsx):
// las mañas de iOS y Firefox con los blobs se arreglan en un solo lugar.
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  if ('download' in a) {
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
  } else {
    // iOS Safari no soporta el atributo `download`: abrimos el PDF en otra pestaña.
    window.open(url, '_blank')
  }

  // Revocar la URL en el mismo tick cancela la descarga en Firefox, Safari y
  // varios WebView de Android: el navegador todavía no leyó el blob. Le damos
  // margen antes de liberar la memoria.
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 60000)
}

export default PresupuestoPDF
