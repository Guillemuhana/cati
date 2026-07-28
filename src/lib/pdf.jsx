import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from '@react-pdf/renderer'
import { formatMoney, formatDate, formatNumero, STATUS } from './utils'

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

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 56,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: LINE
  },

  // ── Encabezado ────────────────────────────────────────────
  headerBox: { flexDirection: 'row', borderWidth: 1, borderColor: LINE },
  headerLogoCell: {
    width: 120,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: LINE
  },
  logo: { width: 100, height: 46, objectFit: 'contain' },
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
  payGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap' },
  payCol: { width: '50%', paddingRight: 12, marginBottom: 8 },
  signRow: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  signBox: { width: '45%' },
  signLine: { borderTopWidth: 0.8, borderTopColor: '#999999', marginBottom: 3, marginTop: 22 },
  signLabel: { fontSize: 7.5, color: SOFT },
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
function Field({ label, value, always = false }) {
  if (!value && !always) return null
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}: </Text>
      <Text style={styles.fieldValue}>{value || ''}</Text>
    </View>
  )
}

function PayCol({ title, text }) {
  if (!text) return null
  return (
    <View style={styles.payCol}>
      <Text style={styles.notesTitle}>{title}</Text>
      <Text style={styles.notesText}>{text}</Text>
    </View>
  )
}

function PresupuestoPDF({ budget, items, client, profile, docLabel = 'Presupuesto', numberPrefix, statusText }) {
  const statusLabel = statusText || (STATUS[budget.status] || STATUS.borrador).label
  const accent = profile?.brand_color || '#1B2A66'
  const numero = formatNumero(budget.numero, budget.issue_date, numberPrefix || profile?.number_prefix)
  const rows = normalizeItems(items)
  const qtyTotal = rows.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)

  return (
    <Document title={`${numero} - ${budget.title || client?.name || ''}`}>
      <Page size="A4" style={styles.page}>
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

        {/* Datos del cliente */}
        <View style={styles.dataBox}>
          <View style={styles.dataCol}>
            <Field label="SEÑOR/ES" value={client?.name || 'Cliente sin asignar'} />
            <Field label="DOMICILIO" value={client?.address} always />
            <Field label="CORREO ELECTRONICO" value={client?.email} always />
            <Field label="CONDICION DE PAGO" value={budget.payment_terms} always />
          </View>
          <View style={styles.dataCol}>
            <Field label="CUIT / CUIL" value={client?.tax_id} always />
            <Field label="TELEFONO" value={client?.phone} always />
            <Field label="FECHA VENCIMIENTO" value={budget.due_date ? formatDate(budget.due_date) : ''} always />
            <Field label="REFERENCIA" value={budget.reference} always />
          </View>
        </View>

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
                <Text style={styles.notesText}>{budget.notes}</Text>
              </>
            )}
            {budget.terms && (
              <>
                <Text style={[styles.notesTitle, { marginTop: 12 }]}>Condiciones</Text>
                <Text style={styles.notesText}>{budget.terms}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.signRow} wrap={false}>
          <View style={styles.signBox}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Firma y aclaración del cliente</Text>
          </View>
          <View style={styles.signBox}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Por {profile?.business_name || 'la empresa'}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {profile?.business_name || ''}{profile?.hide_branding ? '' : ' · Generado con Numera'}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateBudgetPdfBlob({ budget, items, client, profile }) {
  const doc = <PresupuestoPDF budget={budget} items={items} client={client} profile={profile} />
  const instance = pdf(doc)
  return instance.toBlob()
}

export async function downloadBudgetPdf({ budget, items, client, profile }) {
  const blob = await generateBudgetPdfBlob({ budget, items, client, profile })
  triggerDownload(blob, `${formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)}.pdf`)
}

// ── Factura / comprobante (no fiscal) ──────────────────────────
const INVOICE_STATUS = { emitida: 'Emitida', pagada: 'Pagada', anulada: 'Anulada' }

export async function generateInvoicePdfBlob({ invoice, client, profile }) {
  const doc = (
    <PresupuestoPDF
      budget={invoice}
      items={invoice.items || []}
      client={client}
      profile={profile}
      docLabel="Comprobante"
      numberPrefix="FAC"
      statusText={INVOICE_STATUS[invoice.status] || 'Emitida'}
    />
  )
  return pdf(doc).toBlob()
}

export async function downloadInvoicePdf({ invoice, client, profile }) {
  const blob = await generateInvoicePdfBlob({ invoice, client, profile })
  triggerDownload(blob, `${formatNumero(invoice.numero, invoice.issue_date, 'FAC')}.pdf`)
}

// ── Recibo de pago / seña ──────────────────────────────────────
function ReciboPDF({ receipt, client, profile }) {
  const accent = profile?.brand_color || '#1B2A66'
  const numero = formatNumero(receipt.numero, receipt.receipt_date, 'REC')
  return (
    <Document title={numero}>
      <Page size="A4" style={styles.page}>
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

function triggerDownload(blob, filename) {
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
