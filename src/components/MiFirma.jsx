import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Card from './Card'
import { limpiarFirmaAcotada, FIRMA_EN_PUBLIC } from '../lib/limpiarFirma'

/**
 * La firma del dueño, guardada una sola vez.
 *
 * Se sube una foto de la firma hecha en papel; la app le saca el fondo y
 * la deja recortada al trazo. Desde entonces cada acuerdo nace ya
 * firmado: se arma, se manda, y no hay que volver a dibujar nada.
 *
 * Queda en el perfil (columna firma_png, migración 27), no en el
 * navegador: así sirve igual desde la compu y desde el teléfono.
 */
export default function MiFirma() {
  const { profile, updateProfile } = useAuth()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const firma = profile?.firma_png

  const guardar = async (dataUrl) => {
    await updateProfile({ firma_png: dataUrl })
  }

  const desdeArchivo = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // que elegir el mismo archivo dos veces vuelva a disparar
    if (!file) return
    setBusy('archivo')
    setError('')
    try {
      await guardar(await limpiarFirmaAcotada(file))
    } catch (err) {
      setError(err?.message || 'No pudimos procesar esa imagen.')
    }
    setBusy('')
  }

  const desdePublic = async () => {
    setBusy('public')
    setError('')
    try {
      const res = await fetch(FIRMA_EN_PUBLIC, { cache: 'no-store' })
      if (!res.ok) throw new Error(`No encontré ${FIRMA_EN_PUBLIC}.`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) {
        throw new Error(`El archivo ${FIRMA_EN_PUBLIC} no es una imagen.`)
      }
      await guardar(await limpiarFirmaAcotada(blob))
    } catch (err) {
      setError(err?.message || 'No pudimos leer esa imagen.')
    }
    setBusy('')
  }

  const borrar = async () => {
    if (!window.confirm('¿Borrar tu firma guardada? Los acuerdos ya firmados no se tocan.')) return
    setBusy('borrar')
    setError('')
    try {
      await guardar(null)
    } catch {
      setError('No pudimos borrarla.')
    }
    setBusy('')
  }

  return (
    <Card
      title="Mi firma"
      desc={
        firma
          ? 'Cada acuerdo nuevo ya sale firmado por vos.'
          : 'Guardala una vez y no la dibujás nunca más.'
      }
      className="mb-6"
    >
      {firma ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex h-20 items-end border-b border-line">
              <img src={firma} alt="Tu firma" className="max-h-20 max-w-full object-contain" />
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">
              {profile?.firma_nombre || profile?.business_name}
              {profile?.tax_id ? ` · ${profile.tax_id}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!!busy}
              className="rounded-md border border-line px-3 py-2 text-xs font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
            >
              {busy === 'archivo' ? 'Procesando…' : 'Cambiarla'}
            </button>
            <button
              type="button"
              onClick={borrar}
              disabled={!!busy}
              className="text-xs text-ink-faint underline-offset-4 hover:text-rust-500 hover:underline disabled:opacity-60"
            >
              Borrar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm leading-relaxed text-ink-soft">
            Firmá en un papel blanco con birome negra, sacale una foto derecha y subila. La app le
            saca el fondo del papel y deja solo el trazo.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!!busy}
              className="btn-primary rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy === 'archivo' ? 'Procesando…' : 'Subir la foto de mi firma'}
            </button>
            {/* Atajo para la foto que ya está en public/. Ver el aviso de
                abajo: ese archivo lo puede bajar cualquiera. */}
            <button
              type="button"
              onClick={desdePublic}
              disabled={!!busy}
              className="rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
            >
              {busy === 'public' ? 'Procesando…' : `Usar ${FIRMA_EN_PUBLIC}`}
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={desdeArchivo}
        className="hidden"
      />

      {error && (
        <p className="mt-3 rounded-md border border-rust-500/40 bg-rust-500/[0.08] px-3 py-2 text-xs text-rust-500">
          {error}
        </p>
      )}

      {firma && (
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Ya está guardada en tu cuenta. Si la firma quedó en public/, borrá ese archivo del
          proyecto: ahí es descargable por cualquiera que sepa la dirección.
        </p>
      )}
    </Card>
  )
}
