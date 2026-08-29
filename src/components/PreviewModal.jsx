import { formatMoney, formatDate, formatNumero, safeImages, isSafeImageUrl } from '../lib/utils'
import { cleanDetails } from './BudgetDetails'
import { lineAmount } from './ItemsTable'

/**
 * Vista previa en pantalla del presupuesto (HTML, no PDF) antes de finalizar.
 * Reutiliza los mismos datos y totales que se guardan y se exportan.
 */
export default function PreviewModal({ budget, items, client, profile, totals, onClose, actions }) {
  const currency = budget.currency
  const validItems = items.filter((it) => (it.description || '').trim() !== '' || Number(it.unit_price) > 0)
  const logoCliente = isSafeImageUrl(client?.logo_url) ? client.logo_url : ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:p-8">
      <div className="relative w-full max-w-3xl rounded-xl2 bg-surface shadow-soft">
        {/* Barra superior */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl2 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
          <p className="font-display text-sm font-medium text-ink">Vista previa</p>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista previa"
              className="rounded-md p-1.5 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Documento */}
        <div className="p-6 sm:p-10">
          {/* Logo a la derecha, en la misma fila que el título: en celular
              así no se come una fila entera. */}
          <header className="flex items-start justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <p className="font-display text-xl font-medium text-brand-700 sm:text-2xl">Presupuesto</p>
              <p className="mt-0.5 font-mono text-sm text-ink-soft">{formatNumero(budget.numero, budget.issue_date)}</p>
              {budget.reference && <p className="mt-0.5 text-xs text-ink-faint">Ref: {budget.reference}</p>}
              <p className="mt-3 break-words font-display text-lg font-semibold text-ink">
                {profile?.business_name || 'Tu negocio'}
              </p>
              {profile?.tax_id && <p className="break-words text-xs text-ink-soft">{profile.tax_id}</p>}
              {profile?.email && <p className="break-all text-xs text-ink-soft">{profile.email}</p>}
              {profile?.phone && <p className="text-xs text-ink-soft">{profile.phone}</p>}
            </div>
            <div className="shrink-0">
              {profile?.logo_url ? (
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-[83px] w-auto max-w-[143px] object-contain object-right sm:h-[125px] sm:max-w-[260px]"
                />
              ) : (
                <img src="/numera-icon.png" alt="Logo" className="h-[83px] w-[83px] sm:h-[125px] sm:w-[125px]" />
              )}
            </div>
          </header>

          <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Para</p>
              {/* El logo del cliente al lado de sus datos, chico: la hoja la
                  manda el que presupuesta, no el que la recibe. */}
              <div className="mt-1 flex items-start gap-3">
                {logoCliente && (
                  <img
                    src={logoCliente}
                    alt=""
                    className="h-8 w-auto max-w-[72px] shrink-0 object-contain object-left sm:h-10 sm:max-w-[96px]"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{client?.name || 'Cliente sin asignar'}</p>
                  {client?.email && <p className="break-all text-ink-soft">{client.email}</p>}
                  {client?.phone && <p className="text-ink-soft">{client.phone}</p>}
                  {client?.tax_id && <p className="text-ink-soft">{client.tax_id}</p>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Emisión</p>
              <p className="mt-1 text-ink">{formatDate(budget.issue_date)}</p>
              {budget.due_date && (
                <>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Válido hasta</p>
                  <p className="mt-1 text-ink">{formatDate(budget.due_date)}</p>
                </>
              )}
            </div>
          </div>

          {/* Tabla */}
          <div className="mt-8 overflow-hidden rounded-lg border border-line">
            <div className="hidden grid-cols-[1fr_60px_100px_100px] gap-2 border-b border-line bg-paper px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint sm:grid">
              <span>Descripción</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Importe</span>
            </div>
            {validItems.map((it, i) => (
              <div
                key={i}
                className="border-b border-line px-3 py-3 text-sm last:border-0 sm:grid sm:grid-cols-[1fr_60px_100px_100px] sm:items-start sm:gap-2 sm:py-2"
              >
                <span className="block min-w-0 break-words leading-relaxed text-ink">
                  {it.description || 'Ítem'}
                  {Number(it.discount) > 0 && <span className="ml-1 text-xs text-brass-600">-{it.discount}%</span>}
                </span>

                {/* Móvil: cantidad × precio en una línea, importe a la derecha.
                    En celular no entran cuatro columnas: la descripción quedaba
                    tan angosta que caía una palabra por renglón. */}
                <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2 sm:hidden">
                  <span className="font-mono text-xs tabular-nums text-ink-faint">
                    {it.quantity} × {formatMoney(it.unit_price, currency)}
                  </span>
                  <span className="whitespace-nowrap font-mono font-medium tabular-nums text-ink">
                    {formatMoney(lineAmount(it), currency)}
                  </span>
                </div>

                {/* Escritorio: columnas */}
                <span className="hidden text-right font-mono tabular-nums text-ink-soft sm:block">{it.quantity}</span>
                <span className="hidden whitespace-nowrap text-right font-mono tabular-nums text-ink-soft sm:block">
                  {formatMoney(it.unit_price, currency)}
                </span>
                <span className="hidden whitespace-nowrap text-right font-mono font-medium tabular-nums text-ink sm:block">
                  {formatMoney(lineAmount(it), currency)}
                </span>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 font-mono text-sm">
              <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
              {totals.discountAmount > 0 && <Row label="Descuento" value={`-${formatMoney(totals.discountAmount, currency)}`} />}
              {totals.taxAmount > 0 && <Row label={`Impuesto (${budget.tax_rate}%)`} value={formatMoney(totals.taxAmount, currency)} />}
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="font-sans font-semibold text-ink">Total</span>
                <span className="text-base font-semibold text-brand-700">{formatMoney(totals.total, currency)}</span>
              </div>
              {totals.deposit > 0 && (
                <>
                  <Row label="Anticipo / seña" value={`-${formatMoney(totals.deposit, currency)}`} />
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-semibold text-ink">Saldo pendiente</span>
                    <span className="font-semibold text-ink">{formatMoney(totals.balance, currency)}</span>
                  </div>
                  {/* La pregunta que el cliente hace apenas lee el número. */}
                  <p className="pt-1 text-right text-xs italic text-ink-faint">
                    El trabajo comienza una vez recibida la seña.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Pago / notas / condiciones */}
          {(budget.payment_terms || budget.payment_methods || profile?.bank_alias || budget.delivery_time) && (
            <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
              <PreviewBlock title="Condiciones de pago" text={budget.payment_terms} />
              <PreviewBlock title="Formas de pago" text={budget.payment_methods} />
              <PreviewBlock title="Datos bancarios / alias" text={profile?.bank_alias} />
              <PreviewBlock title="Plazo de entrega" text={budget.delivery_time} />
            </div>
          )}
          {(budget.notes || budget.terms) && (
            <div className="mt-6 space-y-4 text-sm">
              <PreviewBlock title="Notas" text={budget.notes} />
              <PreviewBlock title="Condiciones" text={budget.terms} />
            </div>
          )}

          {/* Datos del trabajo */}
          {cleanDetails(budget.details).length > 0 && (
            <div className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {cleanDetails(budget.details).map((d) => (
                <div key={d.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{d.label}</p>
                  <p className="mt-0.5 text-ink">{d.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Imágenes adjuntas */}
          {safeImages(budget.images).length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Imágenes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {safeImages(budget.images).map((url) => (
                  <img key={url} src={url} alt="" className="h-24 w-32 rounded border border-line object-cover" />
                ))}
              </div>
            </div>
          )}

          {/* Espacio de aceptación / firma */}
          <div className="mt-10 grid grid-cols-2 gap-8 pt-6">
            <Signature label="Firma del cliente" />
            <Signature
              firma={profile?.firma_png}
              nombre={profile?.firma_nombre}
              cargo={profile?.firma_cargo}
              label={`Por ${profile?.business_name || 'la empresa'}`}
            />
          </div>

          {/* Términos y condiciones del negocio */}
          {profile?.legal_terms?.trim() && (
            <div className="mt-8 border-t border-line pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Términos y condiciones
              </p>
              <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-ink-faint">
                {profile.legal_terms.trim()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-ink-soft">
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}

function PreviewBlock({ title, text }) {
  if (!text) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{title}</p>
      <p className="mt-1 whitespace-pre-line text-ink-soft">{text}</p>
    </div>
  )
}

// El renglón de firmar. Si el dueño guardó su firma, el presupuesto ya
// sale firmado; el del cliente va vacío, que para eso lo imprime.
function Signature({ firma, nombre, cargo, label }) {
  return (
    <div>
      <div className="flex h-20 items-end border-b border-ink/40">
        {!!firma && <img src={firma} alt="" className="max-h-20 max-w-full object-contain object-left" />}
      </div>
      {!!nombre && <p className="mt-1.5 text-sm font-semibold text-ink">{nombre}</p>}
      {!!cargo && <p className="text-xs text-ink-soft">{cargo}</p>}
      <p className="mt-1.5 text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
    </div>
  )
}
