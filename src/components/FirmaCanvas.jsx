import { useCallback, useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { useTranslation } from 'react-i18next'

/**
 * Recuadro para firmar con el dedo (o con el mouse).
 *
 * Devuelve la firma como PNG con fondo transparente, para que en el PDF
 * el trazo caiga sobre la línea de firma y no tape nada.
 *
 * El dibujo lo hace signature_pad: interpola los puntos con curvas de
 * Bézier y le da grosor según la velocidad, así el trazo sale con la
 * panza y los finos de una lapicera en vez de la línea de alambre que
 * salía uniendo los puntos con rectas. Además maneja solo el punto de un
 * toque seco, que antes había que dibujar a mano.
 *
 * ⚠ DETALLES QUE PARECEN DE ADORNO Y NO LO SON
 *   · touch-action: none — sin esto, el dedo scrollea la página en vez
 *     de dibujar y en el celular es imposible firmar.
 *   · devicePixelRatio — el canvas se dibuja al doble de resolución y se
 *     muestra a la mitad. Si no, la firma sale con los bordes dentados.
 *     Al redimensionar hay que volver a escalar el contexto: el navegador
 *     limpia el canvas y pierde la transformación.
 *   · El trazo se repone después de redimensionar. Girar el teléfono no
 *     puede borrar una firma a medio hacer.
 *
 * Los eventos de puntero y la captura del dedo fuera del recuadro los
 * resuelve la librería, que era de donde salían los dobles trazos en
 * algunos Android.
 */
export default function FirmaCanvas({ value, onChange, disabled = false, alto = 180 }) {
  const { t } = useTranslation()
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const padRef = useRef(null)
  const anchoRef = useRef(0)
  const [vacio, setVacio] = useState(!value)

  // El valor con el que se montó: se dibuja una sola vez. Si mirásemos la
  // prop en cada render, repondría el trazo viejo arriba del que se está
  // haciendo.
  const inicialRef = useRef(typeof value === 'string' && value.startsWith('data:image/') ? value : null)

  // El lienzo se arma una sola vez, así que el aviso tiene que salir por
  // un ref: si no, avisaría para siempre al onChange del primer render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const preparar = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const pad = padRef.current
    if (!canvas || !wrap || !pad) return

    const ancho = wrap.clientWidth
    if (!ancho || ancho === anchoRef.current) return
    anchoRef.current = ancho

    const previo = pad.isEmpty() ? inicialRef.current : pad.toDataURL('image/png')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    canvas.width = Math.round(ancho * dpr)
    canvas.height = Math.round(alto * dpr)
    canvas.style.width = `${ancho}px`
    canvas.style.height = `${alto}px`
    canvas.getContext('2d').scale(dpr, dpr)

    // Después de tocar el tamaño el canvas queda sucio para la librería:
    // clear() la deja en hoja limpia y coherente con lo que se ve.
    pad.clear()

    if (previo) {
      // Si la imagen no carga se pierde el trazo, pero el lienzo queda
      // usable: mejor que dejar una promesa rota dando vueltas.
      pad.fromDataURL(previo, { width: ancho, height: alto }).catch(() => {})
      inicialRef.current = null
    }
  }, [alto])

  useEffect(() => {
    const pad = new SignaturePad(canvasRef.current, {
      penColor: '#14181C',
      // Fondo transparente: en el PDF el trazo cae sobre la línea de
      // firma y no la tapa con un rectángulo blanco.
      backgroundColor: 'rgba(0,0,0,0)',
      minWidth: 0.7,
      maxWidth: 2.6,
      // Un toque seco tiene que dejar marca: es el punto de una firma corta.
      dotSize: 1.3,
      throttle: 8
    })
    padRef.current = pad

    const alTrazar = () => {
      setVacio(false)
      onChangeRef.current?.(pad.toDataURL('image/png'))
    }
    pad.addEventListener('endStroke', alTrazar)

    preparar()
    const obs = new ResizeObserver(() => preparar())
    obs.observe(wrapRef.current)

    return () => {
      obs.disconnect()
      pad.removeEventListener('endStroke', alTrazar)
      pad.off()
      padRef.current = null
    }
    // Solo al montar: preparar() conserva el trazo y onChange se lee del
    // cierre más nuevo a través del pad, no hace falta rehacer el lienzo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mientras está deshabilitado el lienzo no escucha el dedo, pero lo
  // dibujado sigue a la vista.
  useEffect(() => {
    const pad = padRef.current
    if (!pad) return
    if (disabled) pad.off()
    else pad.on()
  }, [disabled])

  const borrar = () => {
    padRef.current?.clear()
    inicialRef.current = null
    setVacio(true)
    onChangeRef.current?.(null)
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
          className="block w-full cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />

        {/* Línea y leyenda de fondo. pointer-events-none: no pueden
            robarle el toque al lienzo. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-line" />
        {vacio && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2.5 text-center text-xs text-ink-faint">
            {t('firma.lienzoAyuda')}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">{t('firma.lienzoNota')}</p>
        <button
          type="button"
          onClick={borrar}
          disabled={disabled || vacio}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-ink/5 hover:text-ink disabled:opacity-40"
        >
          {t('firma.lienzoBorrar')}
        </button>
      </div>
    </div>
  )
}
