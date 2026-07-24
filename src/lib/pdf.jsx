import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from '@react-pdf/renderer'
import { formatMoney, formatDate, formatNumero, STATUS } from './utils'

// Fuentes: usamos Helvetica (nativa de react-pdf) para asegurar que el PDF
// se genere sin depender de carga de red en tiempo de export.
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#14181C'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28
  },
  logo: { width: 52, height: 52, objectFit: 'contain', marginBottom: 8 },
  businessName: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 9, color: '#5B6570', marginTop: 1 },
  docTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  docNumber: { fontSize: 10, color: '#5B6570', textAlign: 'right', marginTop: 2 },
  statusBadge: {
    marginTop: 8,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#1B2A66',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1B2A66',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metaBlock: { maxWidth: '48%' },
  metaLabel: { fontSize: 8, color: '#94998F', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  metaValue: { fontSize: 10.5, fontFamily: 'Helvetica-Bold' },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#14181C',
    paddingBottom: 6,
    marginBottom: 6
  },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5, color: '#5B6570' },
  tr: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E4E1D9'
  },
  colDesc: { flex: 3.4 },
  colQty: { flex: 0.8, textAlign: 'right' },
  colPrice: { flex: 1.2, textAlign: 'right' },
  colDisc: { flex: 0.8, textAlign: 'right' },
  colTotal: { flex: 1.2, textAlign: 'right' },
  totalsBox: { marginTop: 16, alignSelf: 'flex-end', width: 220 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9.5, color: '#5B6570' },
  totalsValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#14181C'
  },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1B2A66' },
  notesBlock: { marginTop: 24 },
  notesTitle: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: '#94998F', marginBottom: 4 },
  notesText: { fontSize: 9, color: '#3A4148', lineHeight: 1.5 },
  payGrid: { marginTop: 28, flexDirection: 'row', flexWrap: 'wrap' },
  payCol: { width: '50%', paddingRight: 12, marginBottom: 12 },
  signRow: { marginTop: 36, flexDirection: 'row', justifyContent: 'space-between' },
  signBox: { width: '45%' },
  signLine: { borderTopWidth: 0.8, borderTopColor: '#94998F', marginBottom: 4, marginTop: 24 },
  signLabel: { fontSize: 8, color: '#94998F', textTransform: 'uppercase', letterSpacing: 0.5 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#E4E1D9',
    paddingTop: 8,
    fontSize: 8,
    color: '#94998F',
    textAlign: 'center'
  }
})

function PayCol({ title, text }) {
  if (!text) return null
  return (
    <View style={styles.payCol}>
      <Text style={styles.notesTitle}>{title}</Text>
      <Text style={styles.notesText}>{text}</Text>
    </View>
  )
}

function PresupuestoPDF({ budget, items, client, profile }) {
  const statusLabel = (STATUS[budget.status] || STATUS.borrador).label
  const accent = profile?.brand_color || '#1B2A66'
  const numero = formatNumero(budget.numero, budget.issue_date, profile?.number_prefix)

  return (
    <Document title={`${numero} - ${budget.title || client?.name || ''}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {profile?.logo_url && <Image src={profile.logo_url} style={styles.logo} />}
            <Text style={styles.businessName}>{profile?.business_name || 'Tu negocio'}</Text>
            {profile?.tax_id && <Text style={styles.small}>{profile.tax_id}</Text>}
            {profile?.email && <Text style={styles.small}>{profile.email}</Text>}
            {profile?.phone && <Text style={styles.small}>{profile.phone}</Text>}
            {profile?.address && <Text style={styles.small}>{profile.address}</Text>}
          </View>
          <View>
            <Text style={[styles.docTitle, { color: accent }]}>Presupuesto</Text>
            <Text style={styles.docNumber}>{numero}</Text>
            {!!budget.reference && <Text style={styles.docNumber}>Ref: {budget.reference}</Text>}
            <Text style={[styles.statusBadge, { borderColor: accent, color: accent }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Para</Text>
            <Text style={styles.metaValue}>{client?.name || 'Cliente sin asignar'}</Text>
            {client?.email && <Text style={styles.small}>{client.email}</Text>}
            {client?.tax_id && <Text style={styles.small}>{client.tax_id}</Text>}
            {client?.address && <Text style={styles.small}>{client.address}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Emisión</Text>
            <Text style={styles.metaValue}>{formatDate(budget.issue_date)}</Text>
            {budget.due_date && (
              <>
                <Text style={[styles.metaLabel, { marginTop: 8 }]}>Válido hasta</Text>
                <Text style={styles.metaValue}>{formatDate(budget.due_date)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDesc]}>Descripción</Text>
            <Text style={[styles.th, styles.colQty]}>Cant.</Text>
            <Text style={[styles.th, styles.colPrice]}>Precio unit.</Text>
            <Text style={[styles.th, styles.colDisc]}>Desc.</Text>
            <Text style={[styles.th, styles.colTotal]}>Importe</Text>
          </View>
          {items.map((it) => {
            const lineBase = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
            const lineTotal = lineBase - lineBase * ((Number(it.discount) || 0) / 100)
            return (
              <View key={it.id} style={styles.tr}>
                <Text style={styles.colDesc}>{it.description}</Text>
                <Text style={styles.colQty}>{it.quantity}</Text>
                <Text style={styles.colPrice}>{formatMoney(it.unit_price, budget.currency)}</Text>
                <Text style={styles.colDisc}>{it.discount ? `${it.discount}%` : '—'}</Text>
                <Text style={styles.colTotal}>{formatMoney(lineTotal, budget.currency)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatMoney(budget.subtotal, budget.currency)}</Text>
          </View>
          {budget.discount_amount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Descuento</Text>
              <Text style={styles.totalsValue}>-{formatMoney(budget.discount_amount, budget.currency)}</Text>
            </View>
          )}
          {budget.tax_amount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Impuesto ({budget.tax_rate}%)</Text>
              <Text style={styles.totalsValue}>{formatMoney(budget.tax_amount, budget.currency)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: accent }]}>{formatMoney(budget.total, budget.currency)}</Text>
          </View>
          {Number(budget.deposit) > 0 && (
            <>
              <View style={[styles.totalsRow, { marginTop: 4 }]}>
                <Text style={styles.totalsLabel}>Anticipo / seña</Text>
                <Text style={styles.totalsValue}>-{formatMoney(budget.deposit, budget.currency)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { fontFamily: 'Helvetica-Bold', color: '#14181C' }]}>Saldo pendiente</Text>
                <Text style={styles.totalsValue}>
                  {formatMoney((Number(budget.total) || 0) - (Number(budget.deposit) || 0), budget.currency)}
                </Text>
              </View>
            </>
          )}
        </View>

        {(budget.payment_terms || budget.payment_methods || profile?.bank_alias || budget.delivery_time) && (
          <View style={styles.payGrid} wrap={false}>
            <PayCol title="Condiciones de pago" text={budget.payment_terms} />
            <PayCol title="Formas de pago" text={budget.payment_methods} />
            <PayCol title="Datos bancarios / alias" text={profile?.bank_alias} />
            <PayCol title="Plazo de entrega" text={budget.delivery_time} />
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
          {profile?.business_name || ''}{profile?.hide_branding ? '' : ' · Generado con Cati'}
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
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${formatNumero(budget.numero, budget.issue_date)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default PresupuestoPDF
