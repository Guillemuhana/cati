import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, MotionConfig } from 'motion/react'
import { supabase } from '../lib/supabaseClient'
import Spinner from '../components/Spinner'
import FirmaCanvas from '../components/FirmaCanvas'
import { formatNumero, resolveAccent, readableAccent } from '../lib/utils'
import { useSeo } from '../lib/seo'
import { downloadNdaPdf } from '../lib/pdfNda'

const ERRORES = {
  ya_firmado: 'Este acuerdo ya fue firmado.',
  falta_nombre: 'Escribí tu nombre completo.',
  falta_firma: 'Dibujá tu firma en el recuadro.',
  firma_muy_grande: 'La firma no se pudo guardar. Borrala y hacela un poco más simple.'
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
        setNombre(res.nda?.firma_parte_nombre || res.nda?.parte_nombre || '')
        setDoc(res.nda?.firma_parte_doc || res.nda?.parte_doc || '')
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
      p_firma: firma
    })

    if (res?.ok) {
      setData((d) => ({
        ...d,
        nda: {
          ...d.nda,
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

  const descargar = async () => {
    setPdfBusy(true)
    try {
      await downloadNdaPdf({ nda, profile: business })
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
                  <p className="mt-4 break-words text-base font-semibold tracking-tight text-ink">
                    {business?.business_name || 'Acuerdo'}
                  </p>
                  {!!business?.tax_id && (
                    <p className="text-xs text-ink-soft">{business.tax_id}</p>
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

              {/* Para qué es esto, en dos renglones y en criollo. El texto
                  legal viene después: si arranca con las cláusulas, el
                  cliente cierra la pestaña. */}
              <div className="mt-6 rounded-lg border border-line bg-paper p-4">
                <p className="text-sm leading-relaxed text-ink">
                  Este acuerdo protege lo que se cuenten las dos partes
                  {nda.proyecto ? ` sobre ${nda.proyecto}` : ''}. Se obligan las dos por igual, por{' '}
                  {nda.vigencia_anios} años. Podés leerlo completo más abajo y firmarlo acá mismo,
                  desde el celular.
                </p>
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
                    {nda.cuerpo}
                  </p>
                </div>
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
                <p className="mb-1 font-display text-lg text-ink">Firmá el acuerdo</p>
                <p className="mb-4 text-sm text-ink-soft">
                  Con el dedo, igual que en un papel.
                </p>

                <FirmaCanvas value={firma} onChange={setFirma} />

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Tu nombre completo
                    </label>
                    <input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      autoComplete="name"
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
                      className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-3 text-base focus:border-brand-500 focus:outline-none"
                    />
                  </div>
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

          <p className="mt-5 text-center text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            Numera de sTuDiO B2B
          </p>
        </div>
      </div>
    </MotionConfig>
  )
}
