import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import Card from '../components/Card'
import FirmaCanvas from '../components/FirmaCanvas'
import { formatDate, formatNumero } from '../lib/utils'
import { urlDeWhatsapp } from '../lib/redes'
import { NDA_STATUS } from '../lib/nda'
import { downloadNdaPdf } from '../lib/pdfNda'

const COLOR_MAP = {
  ink: 'text-ink border-ink/30 bg-ink/[0.03]',
  brass: 'text-brass-600 border-brass-500/40 bg-brass-500/[0.08]',
  teal: 'text-teal-600 border-teal-500/50 bg-teal-500/[0.10]'
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

export default function ConfidencialidadDetail() {
  const { id } = useParams()
  const { profile, isAdmin } = useAuth()
  const [nda, setNda] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verTexto, setVerTexto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  // Firma propia
  const [firma, setFirma] = useState(null)
  const [firmaNombre, setFirmaNombre] = useState('')
  const [firmaDoc, setFirmaDoc] = useState('')
  const [firmando, setFirmando] = useState(false)
  const [dibujar, setDibujar] = useState(false)

  useEffect(() => {
    let activo = true
    supabase
      .from('ndas')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return
        setNda(data || null)
        setLoading(false)
      })
    return () => {
      activo = false
    }
  }, [id])

  useEffect(() => {
    // Por defecto firmás como tu negocio: es lo que dice el acuerdo.
    if (profile && !firmaNombre) setFirmaNombre(profile.business_name || '')
    if (profile && !firmaDoc) setFirmaDoc(profile.tax_id || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (!isAdmin || !nda) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl font-medium text-ink">Acuerdo no encontrado</h1>
        <Link to="/confidencialidad" className="mt-6 inline-block text-sm text-brand-700 underline">
          Volver
        </Link>
      </div>
    )
  }

  const numero = formatNumero(nda.numero, nda.created_at?.slice(0, 10), 'CONF')
  const meta = NDA_STATUS[nda.status] || NDA_STATUS.pendiente
  const publicUrl = `${window.location.origin}/c/${nda.public_token}`
  const cerrado = !!nda.firmado_emisor_at && !!nda.firmado_parte_at

  const saludo = `Hola${nda.parte_nombre ? ` ${nda.parte_nombre}` : ''}, antes de que me cuentes el proyecto te dejo el acuerdo de confidencialidad para que lo leas y lo firmes acá mismo, desde el celular: ${publicUrl}`
  const waCliente = urlDeWhatsapp(nda.parte_telefono)
  const waLink = waCliente
    ? `${waCliente}?text=${encodeURIComponent(saludo)}`
    : `https://wa.me/?text=${encodeURIComponent(saludo)}`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  const firmarYo = async () => {
    if (firmando) return
    // La guardada manda, salvo que hayas elegido dibujarla esta vez.
    const laFirma = dibujar ? firma : profile?.firma_png || firma
    if (!laFirma) {
      setError('Dibujá tu firma en el recuadro antes de confirmar.')
      return
    }
    if (!firmaNombre.trim()) {
      setError('Falta tu nombre.')
      return
    }
    setFirmando(true)
    setError('')

    const cambios = {
      firma_emisor: laFirma,
      firma_emisor_nombre: firmaNombre.trim(),
      firma_emisor_doc: firmaDoc.trim(),
      firmado_emisor_at: new Date().toISOString(),
      // El acuerdo queda cerrado solo cuando firmaron los dos.
      status: nda.firmado_parte_at ? 'firmado' : nda.status
    }

    const { data, error: updErr } = await supabase
      .from('ndas')
      .update(cambios)
      .eq('id', nda.id)
      .select()
      .single()

    if (updErr) {
      setError('No pudimos guardar tu firma. Probá de nuevo.')
      setFirmando(false)
      return
    }
    setNda(data)
    setFirmando(false)
  }

  const descargarPdf = async () => {
    setPdfBusy(true)
    setError('')
    try {
      await downloadNdaPdf({ nda, profile })
    } catch {
      setError('No pudimos generar el PDF. Probá de nuevo.')
    }
    setPdfBusy(false)
  }

  const anular = async () => {
    if (!window.confirm('Anular el acuerdo deja el link sin efecto. ¿Seguro?')) return
    const { data } = await supabase
      .from('ndas')
      .update({ status: 'anulado' })
      .eq('id', nda.id)
      .select()
      .single()
    if (data) setNda(data)
  }

  const nuevoLink = async () => {
    if (!window.confirm('El link que compartiste va a dejar de funcionar. ¿Generar uno nuevo?')) return
    const { data, error: rpcErr } = await supabase.rpc('rotate_nda_token', { p_nda: nda.id })
    if (rpcErr || !data) {
      setError('No pudimos generar un link nuevo.')
      return
    }
    setNda((n) => ({ ...n, public_token: data }))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/confidencialidad" className="text-sm text-ink-soft transition hover:text-ink">
        ← Confidencialidad
      </Link>

      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-medium text-ink sm:text-3xl">
              {nda.parte_nombre || 'Esperando al cliente'}
            </h1>
            <span
              className={`stamp inline-flex items-center rounded-md border-2 px-2.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider ${
                COLOR_MAP[meta.color]
              }`}
            >
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {numero} · {formatDate(nda.created_at?.slice(0, 10))} · vigencia {nda.vigencia_anios} años
          </p>
        </div>
        <button
          onClick={descargarPdf}
          disabled={pdfBusy}
          className="shrink-0 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
        >
          {pdfBusy ? 'Preparando…' : 'Descargar PDF'}
        </button>
      </header>

      {error && (
        <p className="mt-3 rounded-md border border-rust-500/40 bg-rust-500/[0.08] px-3 py-2 text-xs text-rust-500">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {/* Las dos firmas, primero: es lo único que importa mirar acá. */}
        <Card title="Firmas" desc={cerrado ? 'Listo: firmaron los dos.' : 'Falta una de las dos.'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FirmaHecha
              rol="Vos"
              nombre={nda.firma_emisor_nombre || profile?.business_name}
              doc={nda.firma_emisor_doc}
              imagen={nda.firma_emisor}
              cuando={nda.firmado_emisor_at}
            />
            <FirmaHecha
              rol="El cliente"
              nombre={nda.firma_parte_nombre || nda.parte_nombre}
              doc={nda.firma_parte_doc}
              imagen={nda.firma_parte}
              cuando={nda.firmado_parte_at}
            />
          </div>
        </Card>

        {/* Lo que dejó el cliente al firmar. Antes de eso no hay nada que
            mostrar: los datos los pone él, no vos. */}
        {!!nda.firmado_parte_at && (
          <Card title="Datos que dejó el cliente" desc="Los escribió él al firmar.">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Dato label="Nombre o razón social" valor={nda.parte_nombre} />
              <Dato label="DNI o CUIT" valor={nda.parte_doc} />
              <Dato label="Domicilio" valor={nda.parte_domicilio} />
              <Dato label="Email" valor={nda.parte_email} />
              <Dato label="Teléfono" valor={nda.parte_telefono} />
            </dl>
          </Card>
        )}

        {/* Tu firma. Conviene firmar antes de mandar el link: el cliente
            que abre y ve el documento ya firmado de un lado se sienta a
            firmar, no a dudar. */}
        {!nda.firmado_emisor_at && nda.status !== 'anulado' && (
          <Card
            title="Firmá vos primero"
            desc="Mandale el link ya firmado de tu lado: da mucha más confianza."
          >
            {/* Con la firma guardada esto es un botón. El lienzo aparece
                solo si todavía no hay ninguna, o si la querés hacer a
                mano esta vez. */}
            {profile?.firma_png && !dibujar ? (
              <div>
                <div className="flex h-20 items-end border-b border-line">
                  <img
                    src={profile.firma_png}
                    alt="Tu firma guardada"
                    className="max-h-20 max-w-full object-contain"
                  />
                </div>
                <button
                  onClick={() => setDibujar(true)}
                  className="mt-2 text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline"
                >
                  Prefiero dibujarla a mano esta vez
                </button>
              </div>
            ) : (
              <FirmaCanvas value={firma} onChange={setFirma} />
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Tu nombre
                </label>
                <input
                  value={firmaNombre}
                  onChange={(e) => setFirmaNombre(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  DNI o CUIT
                </label>
                <input
                  value={firmaDoc}
                  onChange={(e) => setFirmaDoc(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={firmarYo}
              disabled={firmando}
              className="btn-primary mt-4 w-full rounded-md px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {firmando ? 'Guardando…' : 'Confirmar mi firma'}
            </button>
            <p className="mt-2 text-center text-xs text-ink-faint">
              Una vez confirmada no se puede cambiar.
            </p>
          </Card>
        )}

        {/* El link */}
        {nda.status !== 'anulado' && (
          <Card
            title="Mandáselo al cliente"
            desc={
              nda.firmado_parte_at
                ? 'Ya firmó. El link sigue sirviendo para que vuelva a leerlo.'
                : nda.viewed_at
                  ? `Lo abrió el ${fechaHora(nda.viewed_at)} hs, todavía sin firmar.`
                  : 'Todavía no lo abrió.'
            }
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white"
                style={{ background: '#25D366' }}
              >
                Enviar por WhatsApp
              </a>
              <button
                onClick={copiar}
                className="rounded-md border border-line px-4 py-3 text-sm font-medium text-ink transition hover:border-ink-faint"
              >
                {copiado ? '¡Copiado!' : 'Copiar link'}
              </button>
            </div>
            <input
              readOnly
              value={publicUrl}
              onFocus={(e) => e.target.select()}
              className="mt-3 w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs text-ink-soft"
            />
          </Card>
        )}

        {/* El texto. Colapsado: son doce cláusulas y nadie las lee cada
            vez que entra a la ficha. */}
        <Card
          title="El acuerdo"
          action={
            <button
              onClick={() => setVerTexto((v) => !v)}
              className="text-xs font-medium text-brand-700 underline-offset-4 hover:underline"
            >
              {verTexto ? 'Ocultar' : 'Leer completo'}
            </button>
          }
        >
          {verTexto ? (
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-paper p-4">
              <p className="whitespace-pre-line text-xs leading-relaxed text-ink-soft">{nda.cuerpo}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              Acuerdo mutuo de confidencialidad
              {nda.proyecto ? ` sobre ${nda.proyecto}` : ''}, por {nda.vigencia_anios} años, con
              jurisdicción en {nda.jurisdiccion}.
            </p>
          )}
          {!nda.firmado_parte_at && (
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">
              Donde dice <span className="font-mono">[[PARTE_B]]</span> van los datos del cliente:
              los escribe él al firmar y el texto se completa solo.
            </p>
          )}
          {!!nda.huella && (
            <p className="mt-3 break-all font-mono text-[10px] text-ink-faint">
              Huella SHA-256: {nda.huella}
            </p>
          )}
        </Card>

        {/* Cosas que rompen algo: al final y sin colores llamativos. */}
        {nda.status !== 'anulado' && (
          <div className="flex flex-wrap gap-4 px-1">
            <button onClick={nuevoLink} className="text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline">
              Generar un link nuevo
            </button>
            <button onClick={anular} className="text-xs text-ink-faint underline-offset-4 hover:text-rust-500 hover:underline">
              Anular el acuerdo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Dato({ label, valor }) {
  if (!valor) return null
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{valor}</dd>
    </div>
  )
}

function FirmaHecha({ rol, nombre, doc, imagen, cuando }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{rol}</p>
      <div className="mt-2 flex h-16 items-end border-b border-line">
        {imagen ? (
          <img src={imagen} alt={`Firma de ${nombre || rol}`} className="max-h-16 object-contain" />
        ) : (
          <p className="pb-2 text-xs text-ink-faint">Sin firmar</p>
        )}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-ink">{nombre || '—'}</p>
      {!!doc && <p className="text-xs text-ink-soft">{doc}</p>}
      {!!cuando && <p className="mt-0.5 text-xs text-ink-faint">{fechaHora(cuando)} hs</p>}
    </div>
  )
}
