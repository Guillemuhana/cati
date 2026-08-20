// Un ícono de contacto, venga de donde venga: los de interfaz son
// componentes de lucide-react y los de marca son un trazo de
// simple-icons. Los dos dibujan sobre una caja de 24×24, así que se
// pintan igual y toman el color de donde estén (`currentColor`).
export default function RedIcon({ canal, size = 16, className = '', color }) {
  if (canal.icon) {
    const Icono = canal.icon
    return <Icono size={size} className={className} color={color} aria-hidden="true" />
  }
  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color || 'currentColor'}
      className={className}
    >
      <path d={canal.path} />
    </svg>
  )
}
