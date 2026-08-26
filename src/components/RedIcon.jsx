import { useId } from 'react'

// Un ícono de contacto, venga de donde venga: los de interfaz son
// componentes de lucide-react y los de marca son un trazo de
// simple-icons. Los dos dibujan sobre una caja de 24×24, así que se
// pintan igual y toman el color de donde estén (`currentColor`).
//
// Instagram además lleva su degradado: su logo no es de un color, y
// pintarlo plano lo deja pareciendo un ícono genérico de cámara. Se pasa
// `mono` para forzarlo a un solo color donde el degradado no va (un
// listado a media tinta, un fondo de color).
export default function RedIcon({ canal, size = 16, className = '', color, mono = false }) {
  // Un id por instancia: el degradado se referencia por id y en esta app
  // el mismo ícono se dibuja varias veces en la misma página (el perfil,
  // la fila de contacto). Con un id fijo, todas las copias apuntarían al
  // primer <defs> del documento, que puede haberse desmontado.
  // Los dos puntos que mete useId (":r1:") son válidos en un id pero
  // rompen selectores; se sacan para que `url(#...)` sea siempre limpio.
  const gradId = `g${useId().replace(/:/g, '')}`

  if (canal.icon) {
    const Icono = canal.icon
    return <Icono size={size} className={className} color={color} aria-hidden="true" />
  }

  const usaGradiente = !mono && Array.isArray(canal.gradiente) && canal.gradiente.length > 1

  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={usaGradiente ? `url(#${gradId})` : color || 'currentColor'}
      className={className}
    >
      {usaGradiente && (
        <defs>
          {/* En diagonal, de abajo-izquierda a arriba-derecha, como el
              original. */}
          <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
            {canal.gradiente.map((c, i) => (
              <stop
                key={c + i}
                offset={`${(i / (canal.gradiente.length - 1)) * 100}%`}
                stopColor={c}
              />
            ))}
          </linearGradient>
        </defs>
      )}
      <path d={canal.path} />
    </svg>
  )
}
