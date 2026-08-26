import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, MotionConfig } from 'motion/react'
import { supabase } from '../lib/supabaseClient'
import Spinner from '../components/Spinner'
import FirmaCanvas from '../components/FirmaCanvas'
import { formatNumero, resolveAccent, readableAccent } from '../lib/utils'
import { useSeo } from '../lib/seo'
import { downloadNdaPdf } from '../lib/pdfNda'
import { completarParte, identificarParte, textoVigencia } from '../lib/nda'
import { canalesDe } from '../lib/redes'
import RedIcon from '../components/RedIcon'
import { TRAYECTORIA, POR_QUE_CONTAR } from '../lib/estudio'

const ERRORES = {
  ya_firmado: 'Este acuerdo ya fue firmado.',
  falta_nombre: 'Escribí tu nombre completo.',
  falta_firma: 'Dibujá tu firma en el recuadro.',
  firma_muy_grande: 'La firma no se pudo guardar. Borrala y hacela un poco más simple.'
}

function Garantia({ titulo, texto }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3.5">
      <p className="text-xs font-semibold text-ink">{titulo}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{texto}</p>
    </div>
  )
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

/**
 * El acuerdo tal como lo ve el cliente, desde el link.
 *
 * Lo que tiene que pasar acá, en orden: que entienda qué es, que vea que
 * la otra parte YA firmó, que lea, y que firme con el dedo sin salir de
 * la página. Cualquier paso de más (crear una cuenta, bajar un PDF,
 * imprimir) es un cliente que no firma.
 */
export default function PublicNda() {
  useSeo({ title: 'Acuerdo de confidencialidad', noindex: true })

  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const [firma, setFirma] = useState(null)
  const [nombre, setNombre] = useState('')
  const [doc, setDoc] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [firmando, setFirmando] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    let activo = true
    ;(async () => {
      const { data: res, error: rpcErr } = await supabase.rpc('get_public_nda', { p_token: token })
      if (!activo) return
      if (rpcErr || !res) setNotFound(true)
      else {
        setData(res)
        // Si ya firmó, los campos muestran lo que puso. Si no, arrancan
        // vacíos: los datos los escribe él, no vienen puestos de antes.
        setNombre(res.nda?.firma_parte_nombre || '')
        setDoc(res.nda?.firma_parte_doc || '')
        setDomicilio(res.nda?.parte_domicilio || '')
      }
      setLoading(false)
    })()
    return () => {
      activo = false
    }
  }, [token])

  const firmar = async () => {
    if (firmando) return
    if (!firma) {
      setError('Dibujá tu firma en el recuadro.')
      return
    }
    if (!nombre.trim()) {
      setError('Escribí tu nombre completo.')
      return
    }
    setFirmando(true)
    setError('')

    const { data: res, error: rpcErr } = await supabase.rpc('sign_nda', {
      p_token: token,
      p_nombre: nombre.trim(),
      p_doc: doc.trim(),
      p_firma: firma,
      p_domicilio: domicilio.trim(),
      p_email: email.trim(),
      p_telefono: telefono.trim()
    })

    if (res?.ok) {
      setData((d) => ({
        ...d,
        nda: {
          ...d.nda,
          // El cuerpo y la huella vuelven ya completos con sus datos:
          // los armó la base, no este navegador.
          cuerpo: res.cuerpo ?? d.nda.cuerpo,
          huella: res.huella ?? d.nda.huella,
          parte_domicilio: domicilio.trim(),
          status: res.status,
          firmado_parte_at: res.firmado_parte_at,
          firma_parte: res.firma_parte,
          firma_parte_nombre: res.firma_parte_nombre,
          firma_parte_doc: res.firma_parte_doc
        }
      }))
    } else if (res?.reason) {
      setError(ERRORES[res.reason] || 'No pudimos registrar tu firma.')
    } else {
      setError(
        rpcErr
          ? 'No pudimos registrar tu firma. Probá de nuevo en un momento.'
          : 'Este enlace ya no está disponible. Pedile uno nuevo a quien te lo envió.'
      )
    }
    setFirmando(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
        <img src="/numera-icon.png" alt="Numera" className="mb-4 h-16 w-16" />
        <h1 className="font-display text-xl font-medium text-ink">Acuerdo no encontrado</h1>
        <p className="mt-1 text-sm text-ink-soft">
          El enlace puede haber cambiado o ya no está disponible.
        </p>
      </div>
    )
  }

  const { nda, business } = data
  const accent = resolveAccent(business?.brand_color)
  const accentInk = readableAccent(accent)
  const numero = formatNumero(nda.numero, nda.created_at?.slice(0, 10), 'CONF')
  const yaFirmo = !!nda.firmado_parte_at

  // El acuerdo llega con un hueco donde va la identificación de quien
  // firma. Se completa en pantalla a medida que escribe, para que vea
  // exactamente cómo va a quedar antes de firmar. Lo que se guarda lo
  // arma la base: esto es solo lo que se muestra.
  const misDatos = { nombre, doc, domicilio }
  const identificacion = identificarParte(misDatos)
  const cuerpoVisible = yaFirmo ? nda.cuerpo : completarParte(nda.cuerpo, misDatos)
  const canales = canalesDe(business)

  const descargar = async () => {
    setPdfBusy(true)
    try {
      // Con el hueco ya reemplazado: si todavía no firmó, el PDF sale con
      // la línea en blanco donde van sus datos, como un contrato de papel
      // sin completar. Nunca con el marcador crudo a la vista.
      await downloadNdaPdf({ nda: { ...nda, cuerpo: cuerpoVisible }, profile: business })
    } catch {
      setError('No pudimos generar el PDF.')
    }
    setPdfBusy(false)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-paper py-6 sm:py-10">
        <div className="mx-auto max-w-3xl px-4">
          <div className="overflow-hidden rounded-xl2 border border-line bg-surface shadow-soft">
            <div className="h-1.5" style={{ background: accent }} />

            <div className="p-4 sm:p-10">
              <header className="flex items-start justify-between gap-4 sm:gap-6">
                <div className="min-w-0">
                  <p
                    className="font-display text-2xl font-medium leading-tight sm:text-3xl"
                    style={{ color: accentInk }}
                  >
                    Acuerdo de confidencialidad
                  </p>
                  <p className="mt-1.5 font-mono text-sm tabular-nums tracking-tight text-ink-soft">
                    {numero}
                  </p>
                  {/* Quién lo manda, con nombre, CUIT y domicilio. Del
                      otro lado hay alguien que todavía no confía: los
                      datos verificables del emisor son lo primero que
                      mira, antes que cualquier cláusula. */}
                  <p className="mt-4 break-words text-base font-semibold tracking-tight text-ink">
                    {business?.business_name || 'Acuerdo'}
                  </p>
                  {!!business?.tax_id && (
                    <p className="text-xs tabular-nums text-ink-soft">CUIT {business.tax_id}</p>
                  )}
                  {!!business?.address && (
                    <p className="break-words text-xs text-ink-soft">{business.address}</p>
                  )}
                  {/* La trayectoria, pegada al nombre: es una credencial,
                      y como tal vale al lado de quién sos, no perdida
                      más abajo entre los textos. */}
                  {!!TRAYECTORIA && (
                    <p className="mt-2 text-xs font-medium" style={{ color: accentInk }}>
                      {TRAYECTORIA}
                    </p>
                  )}
                </div>
                {business?.logo_url ? (
                  <img
                    src={business.logo_url}
                    alt=""
                    className="h-[70px] w-auto max-w-[130px] shrink-0 object-contain object-right sm:h-[110px] sm:max-w-[220px]"
                  />
                ) : (
                  <img src="/numera-icon.png" alt="" className="h-[70px] w-[70px] shrink-0 sm:h-[110px] sm:w-[110px]" />
                )}
              </header>

              {/* Los canales de contacto del emisor, a un toque. Un
                  WhatsApp que contesta convence más que cualquier
                  cláusula: el que duda quiere poder preguntar antes de
                  firmar, no después. */}
              {canales.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {canales.map((c) =>
                    c.href ? (
                      <a
                        key={c.key}
                        href={c.href}
                        target={c.href.startsWith('http') ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        title={c.label}
                        className="inline-flex items-center gap-1.5 text-xs text-ink-soft transition hover:text-ink"
                      >
                        <RedIcon canal={c} color={c.color} />
                        <span className="break-all">{c.texto}</span>
                      </a>
                    ) : null
                  )}
                </div>
              )}

              {/* Para qué es esto, en dos renglones y en criollo. El texto
                  legal viene después: si arranca con las cláusulas, el
                  cliente cierra la pestaña. */}
              <div className="mt-6 rounded-lg border border-line bg-paper p-4">
                <p className="text-sm leading-relaxed text-ink">
                  Este acuerdo protege lo que se cuenten las dos partes
                  {nda.proyecto ? ` sobre ${nda.proyecto}` : ''}. Se obligan las dos por igual y{' '}
                  {textoVigencia(nda.vigencia_anios)}. Podés leerlo completo más abajo y firmarlo
                  acá mismo, desde el celular.
                </p>
              </div>

              {/* La pregunta que el cliente se hace mientras lee: «¿y por
                  qué tengo que contarte todo?». Contestarla acá, antes de
                  la charla, es la mitad del trabajo de convencerlo. */}
              {!!POR_QUE_CONTAR?.texto && (
                <div className="mt-4 rounded-lg border-l-2 bg-paper p-4" style={{ borderLeftColor: accent }}>
                  <p className="text-sm font-semibold text-ink">{POR_QUE_CONTAR.titulo}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {POR_QUE_CONTAR.texto}
                  </p>
                  {!!POR_QUE_CONTAR.cierre && (
                    <p className="mt-2 text-sm font-medium leading-relaxed text-ink">
                      {POR_QUE_CONTAR.cierre}
                    </p>
                  )}
                </div>
              )}

              {/* Las tres dudas que tiene cualquiera al abrir un link que
                  le pide firmar algo, contestadas antes de que las
                  piense. */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Garantia
                  titulo="Tu idea sigue siendo tuya"
                  texto="No buscamos ser socios ni quedarnos con un porcentaje de tu app. Desarrollamos y cobramos por el trabajo y el mantenimiento, nada más."
                />
                <Garantia
                  titulo="No vence"
                  texto="La confidencialidad no tiene fecha de corte: sigue aunque no trabajemos juntos."
                />
                <Garantia
                  titulo="Los dos por igual"
                  texto="Es mutuo: nosotros nos obligamos con vos igual que vos con nosotros."
                />
                <Garantia
                  titulo="Queda constancia"
                  texto="Fecha, hora y una huella digital del texto firmado, en tu PDF."
                />
              </div>

              {/* Que la otra parte ya firmó es lo que baja la desconfianza.
                  Va arriba del texto, no escondido al final. */}
              {!!nda.firmado_emisor_at && (
                <div className="mt-4 flex items-center gap-4 rounded-lg border border-teal-500/40 bg-teal-500/[0.06] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-teal-600">
                      {nda.firma_emisor_nombre || business?.business_name} ya firmó
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      El {fechaHora(nda.firmado_emisor_at)} hs
                      {nda.firma_emisor_doc ? ` · ${nda.firma_emisor_doc}` : ''}
                    </p>
                  </div>
                  {!!nda.firma_emisor && (
                    <img
                      src={nda.firma_emisor}
                      alt=""
                      className="h-12 w-auto max-w-[40%] shrink-0 object-contain"
                    />
                  )}
                </div>
              )}

              {/* El texto. Con altura acotada y scroll propio: si ocupa la
                  pantalla entera, el botón de firmar queda a diez pantallas
                  de distancia y no lo encuentra nadie. */}
              <div className="mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  Texto del acuerdo
                </p>
                <div className="mt-2 max-h-[45vh] overflow-y-auto rounded-lg border border-line bg-paper p-4">
                  <p className="whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                    {cuerpoVisible}
                  </p>
                </div>

                {/* Poder bajarlo ANTES de firmar es de las cosas que más
                    tranquilizan: el que quiere mostrárselo a su abogado
                    puede, y el que no, ya se queda tranquilo de que
                    podría. Antes solo se podía descargar después. */}
                {!yaFirmo && (
                  <button
                    onClick={descargar}
                    disabled={pdfBusy}
                    className="mt-3 text-xs font-medium text-ink-soft underline-offset-4 transition hover:text-ink hover:underline disabled:opacity-60"
                  >
                    {pdfBusy ? 'Preparando…' : 'Descargar el PDF para leerlo con calma'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Firmar */}
          <motion.div
            layout
            className="mt-4 rounded-xl2 border border-line bg-surface p-5 shadow-soft sm:p-6"
          >
            {yaFirmo ? (
              <div className="text-center">
                <p className="text-base font-semibold text-teal-600">
                  Firmaste el acuerdo. ¡Gracias!
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Quedó registrado el {fechaHora(nda.firmado_parte_at)} hs a nombre de{' '}
                  {nda.firma_parte_nombre}.
                </p>
                {!!nda.firma_parte && (
                  <img
                    src={nda.firma_parte}
                    alt=""
                    className="mx-auto mt-3 h-16 w-auto max-w-[220px] object-contain"
                  />
                )}
                <button
                  onClick={descargar}
                  disabled={pdfBusy}
                  className="mt-4 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
                >
                  {pdfBusy ? 'Preparando…' : 'Descargar una copia en PDF'}
                </button>
              </div>
            ) : (
              <>
                <p className="mb-1 font-display text-lg text-ink">Completá tus datos y firmá</p>
                <p className="mb-4 text-sm text-ink-soft">
                  Los escribís vos. Se completan solos en el acuerdo de arriba.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Nombre completo o razón social
                    </label>
                    <input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      autoComplete="name"
                      placeholder="Juan Pérez"
                      className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      DNI o CUIT
                    </label>
                    <input
                      value={doc}
                      onChange={(e) => setDoc(e.target.value)}
                      inputMode="numeric"
                      placeholder="30.111.222"
                      className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Domicilio
                    </label>
                    <input
                      value={domicilio}
                      onChange={(e) => setDomicilio(e.target.value)}
                      autoComplete="street-address"
                      placeholder="Av. Siempre Viva 742"
                      className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Email <span className="normal-case tracking-normal">(opcional)</span>
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Teléfono <span className="normal-case tracking-normal">(opcional)</span>
                    </label>
                    <input
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      type="tel"
                      autoComplete="tel"
                      className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* El texto de arriba también se completó, pero queda
                    fuera de la vista mientras escribe. Repetirlo acá es
                    lo que le muestra que sus datos entran al acuerdo. */}
                {!!identificacion && (
                  <div className="mt-4 rounded-lg border border-line bg-paper px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      Vas a figurar así en el acuerdo
                    </p>
                    <p className="mt-1 break-words text-sm text-ink">{identificacion}</p>
                  </div>
                )}

                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Tu firma
                  </p>
                  <FirmaCanvas value={firma} onChange={setFirma} />
                </div>

                <button
                  onClick={firmar}
                  disabled={firmando}
                  className="mt-5 w-full rounded-xl px-7 py-4 text-base font-semibold tracking-tight text-white disabled:opacity-60"
                  style={{
                    background: '#14181C',
                    boxShadow:
                      '0 10px 22px -8px rgba(20, 24, 28, 0.45), 0 3px 8px -3px rgba(20, 24, 28, 0.25)'
                  }}
                >
                  {firmando ? 'Registrando…' : 'Firmar el acuerdo'}
                </button>

                <p className="mt-3 text-center text-xs leading-relaxed text-ink-faint">
                  Al firmar declarás haber leído y aceptado el acuerdo. Quedan registradas la fecha
                  y la hora de tu firma.
                </p>

                {error && <p className="mt-3 text-center text-sm text-rust-500">{error}</p>}
              </>
            )}
          </motion.div>

          {/* El pie lo firma el emisor, no la app. En un documento que se
              manda para generar confianza, la marca que tiene que quedar
              es la de quien lo manda. */}
          <div className="mt-6 text-center">
            <p className="text-sm font-semibold tracking-tight text-ink">
              {business?.business_name || 'Acuerdo de confidencialidad'}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {[business?.tax_id && `CUIT ${business.tax_id}`, business?.email, business?.phone]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {!business?.hide_branding && (
              <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                Documento emitido con Numera
              </p>
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}
