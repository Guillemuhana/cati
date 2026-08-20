import { useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { safePdfUrl } from '../lib/utils'

const MAX_BYTES = 15 * 1024 * 1024 // igual que el límite del bucket (migración 25)

/**
 * El PDF que arma el propio usuario.
 *
 * Hay rubros donde la propuesta no es una lista de ítems: un fotógrafo
 * manda un PDF con la selección de fotos y los packs, ya diseñado. Acá
 * lo sube y viaja con el presupuesto: el cliente lo abre desde el mismo
 * enlace, sin recibir dos cosas sueltas por separado.
 *
 * Se sube apenas se elige (así el usuario ve enseguida si pesa
 * demasiado) y queda como URL en budget.pdf_url. El archivo viejo se
 * borra recién al guardar, igual que con las imágenes: si borráramos
 * acá y el usuario cancela, se perdió el PDF.
 */
export default function BudgetPdfPropio({ userId, value = '', onChange }) {
  const url = safePdfUrl(value)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFile = async (e) => {
    const file = (e.target.files || [])[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return

    setError('')
    if (file.type !== 'application/pdf') {
      setError('Tiene que ser un archivo PDF.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(
        `«${file.name}» pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es 15 MB. Exportalo con las imágenes más comprimidas.`
      )
      return
    }

    setSubiendo(true)
    try {
      const path = `${userId}/presupuestos/${crypto.randomUUID()}.pdf`
      const { error: upErr } = await supabase.storage
        .from('adjuntos')
        .upload(path, file, { cacheControl: '3600', contentType: 'application/pdf' })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('adjuntos').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      const msg = `${err?.message || ''}`.toLowerCase()
      setError(
        msg.includes('mime') || msg.includes('bucket') || msg.includes('not found')
          ? 'Ejecutá la migración supabase/migration_25 en Supabase para poder subir PDF.'
          : msg.includes('exceeded') || msg.includes('too large')
            ? 'El archivo supera el límite del servidor. Ejecutá la migración 25 o probá con un PDF más liviano.'
            : err?.message || 'No se pudo subir el PDF.'
      )
    } finally {
      setSubiendo(false)
    }
  }

  if (url) {
    return (
      <div className="flex items-center gap-3 rounded-xl2 border border-line bg-paper/60 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rust-500/10 text-rust-500">
          <FileText size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Tu PDF está cargado</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Es lo primero que se le ofrece al cliente al compartir.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink"
          >
            Ver
          </a>
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-rust-500 transition hover:bg-rust-500/[0.08]"
          >
            Quitar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="flex w-full items-center justify-center gap-2 rounded-xl2 border border-dashed border-line px-4 py-6 text-sm font-medium text-ink-soft transition hover:border-brand-500/50 hover:text-ink disabled:opacity-60"
      >
        <FileText size={17} aria-hidden="true" />
        {subiendo ? 'Subiendo…' : 'Elegir un PDF'}
      </button>
      <p className="mt-1.5 text-xs text-ink-faint">Un archivo, hasta 15 MB.</p>
      {error && <p className="mt-2 text-xs text-rust-500">{error}</p>}
    </div>
  )
}
