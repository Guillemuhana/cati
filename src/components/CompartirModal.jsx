import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Link2, Mail, QrCode, Send, Check } from 'lucide-react'
import { trazo } from '../lib/brandPaths'
import { urlDeWhatsapp } from '../lib/redes'

/**
 * Un solo lugar para mandarle el presupuesto al cliente.
 *
 * Antes esto estaba repartido en tres sitios de la pantalla (un botón
 * arriba, una tarjeta al costado y un «copiar enlace» abajo que además
 * copiaba la dirección del panel, que el cliente no puede abrir). Acá
 * cada fila dice a dónde va y a quién: «WhatsApp — a 11 5555-4444».
 *
 * El orden no es casual: primero por dónde se manda de verdad
 * (WhatsApp, email), después el enlace suelto, y al final el PDF, que
 * es para guardarlo o adjuntarlo a mano.
 */
export default function CompartirModal({
  onClose,
  publicUrl,
  qr,
  saludo,
  asunto,
  cliente,
  esPremium,
  onDescargarPdf,
  onEnviarPdf,
  pdfPropio,
  ocupado
}) {
  const [copiado, setCopiado] = useState(false)
  const [verQr, setVerQr] = useState(false)

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles (o http): que al menos lo pueda
      // seleccionar a mano desde el campo de abajo.
      setCopiado(false)
    }
  }

  // Si el cliente tiene teléfono cargado, el mensaje sale derecho a su
  // chat. Si no, WhatsApp le va a pedir a quién mandárselo.
  const waCliente = urlDeWhatsapp(cliente?.phone)
  const waLink = waCliente
    ? `${waCliente}?text=${encodeURIComponent(saludo)}`
    : `https://wa.me/?text=${encodeURIComponent(saludo)}`
  const mailLink = `mailto:${cliente?.email || ''}?subject=${encodeURIComponent(
    asunto
  )}&body=${encodeURIComponent(saludo)}`

  // En el celular el navegador ofrece el menú de compartir del sistema y
  // el PDF se manda por donde el usuario quiera. En escritorio no existe:
  // ahí lo único honesto es descargarlo.
  const puedeCompartirArchivo = typeof navigator !== 'undefined' && !!navigator.canShare

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compartir presupuesto"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl2 border border-line bg-surface shadow-soft sm:rounded-xl2"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
          <p className="font-display text-base font-medium text-ink">Compartir</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 p-4 sm:p-5">
          {esPremium && publicUrl && (
            <>
              <Opcion
                as="a"
                href={waLink}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                color="#25D366"
                path={trazo('whatsapp')}
                titulo="Enviar por WhatsApp"
                detalle={waCliente ? `A ${cliente.phone}` : 'Elegís el contacto en WhatsApp'}
              />
              <Opcion
                as="a"
                href={mailLink}
                onClick={onClose}
                color="#2F6BFF"
                Icono={Mail}
                titulo="Enviar por email"
                detalle={cliente?.email || 'Escribís el destinatario en tu correo'}
              />
              <Opcion
                as="button"
                onClick={copiar}
                color={copiado ? '#0F9B8E' : '#5B6570'}
                Icono={copiado ? Check : Link2}
                titulo={copiado ? 'Enlace copiado' : 'Copiar enlace'}
                detalle={copiado ? 'Pegalo donde quieras' : publicUrl.replace(/^https?:\/\//, '')}
              />
            </>
          )}

          {esPremium && publicUrl && (
            <div className="rounded-xl2 border border-line bg-paper/60 p-1">
              <button
                type="button"
                onClick={() => setVerQr((v) => !v)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-soft transition hover:text-ink"
              >
                <QrCode size={15} aria-hidden="true" />
                {verQr ? 'Ocultar código QR' : 'Mostrar código QR'}
              </button>
              {verQr && (
                <div className="px-3 pb-3 pt-1 text-center">
                  {qr ? (
                    <img
                      src={qr}
                      alt="Código QR del presupuesto"
                      className="mx-auto h-40 w-40 rounded-lg border border-line bg-white p-1.5"
                    />
                  ) : (
                    <p className="text-xs text-ink-faint">No se pudo generar el código.</p>
                  )}
                  <p className="mt-2 text-xs text-ink-soft">
                    Para mostrarlo en el mostrador o en la obra: el cliente lo escanea y le abre el
                    presupuesto.
                  </p>
                </div>
              )}
            </div>
          )}

          {!esPremium && (
            <Link
              to="/premium"
              onClick={onClose}
              className="block rounded-xl2 border border-dashed border-brand-500/40 bg-brand-500/[0.04] p-4 transition hover:bg-brand-500/[0.07]"
            >
              <p className="text-sm font-semibold text-brand-700">Enlace para el cliente + QR</p>
              <p className="mt-1 text-xs text-ink-soft">
                Mandale un link para que lo vea desde el celular y lo acepte con un botón. Vos te
                enterás cuando lo abre. Es una función premium.
              </p>
            </Link>
          )}

          <div className="pt-1">
            <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              El documento
            </p>
            {/* Si subió el suyo, ese manda: es el que armó para este
                cliente. El de Numera queda abajo, por las dudas. */}
            {pdfPropio && (
              <Opcion
                as="a"
                href={pdfPropio}
                target="_blank"
                rel="noreferrer"
                color="#B4441F"
                Icono={FileText}
                titulo="Abrir tu PDF"
                detalle="El que subiste vos. Ya viaja en el enlace del cliente"
                className="mb-2"
              />
            )}
            {puedeCompartirArchivo && (
              <Opcion
                as="button"
                onClick={onEnviarPdf}
                disabled={ocupado}
                color="#5B6570"
                Icono={Send}
                titulo="Enviar el PDF"
                detalle="Por la app que quieras, con el archivo adjunto"
              />
            )}
            <Opcion
              as="button"
              onClick={onDescargarPdf}
              disabled={ocupado}
              color="#5B6570"
              Icono={Download}
              titulo={pdfPropio ? 'Descargar el PDF de Numera' : 'Descargar el PDF'}
              detalle="Para guardarlo o imprimirlo"
              className={puedeCompartirArchivo ? 'mt-2' : ''}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Una fila del menú: ícono con el color del canal, qué hace y a dónde va.
function Opcion({ as, Icono, path, color, titulo, detalle, className = '', ...props }) {
  const Tag = as === 'a' ? 'a' : 'button'
  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' } : {})}
      {...props}
      className={`flex w-full items-center gap-3 rounded-xl2 border border-line bg-surface px-4 py-3 text-left transition hover:border-ink-faint hover:bg-paper disabled:opacity-60 ${className}`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        {Icono ? (
          <Icono size={17} aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
            <path d={path} />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{titulo}</span>
        <span className="block truncate text-xs text-ink-soft">{detalle}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        width="16"
        height="16"
        className="shrink-0 text-ink-faint"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Tag>
  )
}
