import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export const MAX_IMAGES = 4
const MAX_BYTES = 5 * 1024 * 1024 // igual que el límite del bucket (migración 20)
const TIPOS = ['image/png', 'image/jpeg', 'image/webp']

// Imágenes opcionales del presupuesto: una foto del trabajo, un plano,
// una referencia. Se suben apenas se eligen (así el usuario ve enseguida
// si pesan demasiado) y quedan como URLs en budget.images.
export default function BudgetImages({ userId, value = [], onChange }) {
  const images = Array.isArray(value) ? value : []
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const lugar = MAX_IMAGES - images.length

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!files.length) return

    setError('')

    if (files.length > lugar) {
      setError(`Podés subir hasta ${MAX_IMAGES} imágenes por presupuesto.`)
      return
    }
    const pesada = files.find((f) => f.size > MAX_BYTES)
    if (pesada) {
      setError(`«${pesada.name}» pesa más de 5 MB. Probá con una foto más liviana.`)
      return
    }
    const rara = files.find((f) => !TIPOS.includes(f.type))
    if (rara) {
      setError('Solo se pueden subir imágenes JPG, PNG o WEBP.')
      return
    }

    setSubiendo(true)
    try {
      const nuevas = []
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${userId}/presupuestos/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('adjuntos')
          .upload(path, file, { cacheControl: '3600' })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('adjuntos').getPublicUrl(path)
        nuevas.push(data.publicUrl)
      }
      onChange([...images, ...nuevas])
    } catch (err) {
      const msg = `${err?.message || ''}`.toLowerCase()
      setError(
        msg.includes('bucket') || msg.includes('not found')
          ? 'Ejecutá la migración supabase/migration_20 en Supabase para poder subir imágenes.'
          : err?.message || 'No se pudo subir la imagen.'
      )
    } finally {
      setSubiendo(false)
    }
  }

  // Se saca de la lista; el archivo en Storage se borra recién al guardar
  // el presupuesto (si borráramos acá y el usuario cancela, perdimos la foto).
  const quitar = (url) => onChange(images.filter((u) => u !== url))

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((url) => (
          <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-line bg-paper">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => quitar(url)}
              aria-label="Quitar imagen"
              className="absolute right-1 top-1 rounded-full bg-ink/70 px-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}

        {lugar > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-ink-soft transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
          >
            <span className="text-xl leading-none">+</span>
            <span className="text-xs">{subiendo ? 'Subiendo…' : 'Agregar'}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {error ? (
        <p className="mt-2 text-xs text-rust-500">{error}</p>
      ) : (
        <p className="mt-2 text-xs text-ink-faint">
          Opcional. Hasta {MAX_IMAGES} imágenes de 5 MB (JPG, PNG o WEBP). Se ven en el PDF y en el enlace que le mandás
          al cliente.
        </p>
      )}
    </div>
  )
}
