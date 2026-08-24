import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Recuadro para firmar con el dedo (o con el mouse).
 *
 * Devuelve la firma como PNG con fondo transparente, para que en el PDF
 * el trazo caiga sobre la línea de firma y no tape nada.
 *
 * ⚠ DETALLES QUE PARECEN DE ADORNO Y NO LO SON
 *   · touch-action: none — sin esto, el dedo scrollea la página en vez
 *     de dibujar y en el celular es imposible firmar.
 *   · Pointer Events — un solo camino para dedo, lápiz y mouse. Con
 *     eventos de mouse y de touch por separado, en algunos Android se
 *     dispara todo dos veces y la firma sale con dobles trazos.
 *   · devicePixelRatio — el canvas se dibuja al doble de resolución y se
 *     muestra a la mitad. Si no, la firma sale con los bordes dentados.
 *   · setPointerCapture — si el dedo se va del recuadro mientras firma,
 *     el trazo se corta a mitad de camino y el usuario cree que se
 *     rompió. Con la captura el trazo se sigue hasta que suelta.
 */
export default function FirmaCanvas({ value, onChange, disabled = false, alto = 180 }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const dibujando = useRef(false)
  const ultimo = useRef(null)
  const [vacio, setVacio] = useState(!value)

  // Espejo de `vacio` en un ref: preparar() se registra una sola vez en el
  // ResizeObserver, así que si mirara el estado vería para siempre el
  // valor del primer render y un giro de pantalla borraría la firma.
  const vacioRef = useRef(true)
  const anchoRef = useRef(0)

  // Prepara el lienzo al tamaño real del contenedor. Se llama al montar y
  // cada vez que cambia el ancho (girar el teléfono, abrir el teclado).
  const preparar = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ancho = wrap.clientWidth
    if (!ancho || ancho === anchoRef.current) return
    anchoRef.current = ancho

    const previo = !vacioRef.current ? canvas.toDataURL('image/png') : null
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    canvas.width = Math.round(ancho * dpr)
    canvas.height = Math.round(alto * dpr)
    canvas.style.width = `${ancho}px`
    canvas.style.height = `${alto}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#14181C'

    // El trazo que ya había se repone estirado al lienzo nuevo: girar el
    // teléfono no puede borrar una firma a medio hacer.
    if (previo) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, ancho, alto)
      img.src = previo
    }
  }, [alto])

  useEffect(() => {
    preparar()
    const obs = new ResizeObserver(() => preparar())
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
    // Solo al montar: preparar() se encarga de conservar el trazo, pero
    // no queremos rehacer el lienzo en cada trazo nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const puntoDe = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const empezar = (e) => {
    if (disabled) return
    e.preventDefault()
    dibujando.current = true
    ultimo.current = puntoDe(e)
    canvasRef.current.setPointerCapture?.(e.pointerId)

    // Un toque seco sin arrastrar también deja marca: si no, el punto de
    // una firma corta no se dibuja nunca.
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.arc(ultimo.current.x, ultimo.current.y, 1.1, 0, Math.PI * 2)
    ctx.fillStyle = '#14181C'
    ctx.fill()
    vacioRef.current = false
    setVacio(false)
  }

  const mover = (e) => {
    if (!dibujando.current || disabled) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p = puntoDe(e)
    ctx.beginPath()
    ctx.moveTo(ultimo.current.x, ultimo.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ultimo.current = p
  }

  const terminar = (e) => {
    if (!dibujando.current) return
    dibujando.current = false
    try {
      canvasRef.current.releasePointerCapture?.(e.pointerId)
    } catch {
      // El puntero ya se había soltado solo. No es un problema.
    }
    onChange?.(canvasRef.current.toDataURL('image/png'))
  }

  const borrar = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    vacioRef.current = true
    setVacio(true)
    onChange?.(null)
  }

  return (
    <div>
      <div
        ref={wrapRef}
        className={`relative overflow-hidden rounded-xl2 border-2 border-dashed bg-surface ${
          disabled ? 'border-line opacity-60' : 'border-line'
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          className="block w-full cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />

        {/* Línea y leyenda de fondo. pointer-events-none: no pueden
            robarle el toque al lienzo. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-line" />
        {vacio && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2.5 text-center text-xs text-ink-faint">
            Firmá acá arriba con el dedo
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">Se guarda tal cual la dibujaste.</p>
        <button
          type="button"
          onClick={borrar}
          disabled={disabled || vacio}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-ink/5 hover:text-ink disabled:opacity-40"
        >
          Borrar y firmar de nuevo
        </button>
      </div>
    </div>
  )
}
