import { useEffect, useRef, useState } from 'react'

/**
 * La cortina de entrada: el logo animado, una vez, al abrir la app.
 *
 * Tres reglas que la hacen soportable y no un peaje:
 *
 *   1. UNA VEZ POR VISITA. Queda marcado en sessionStorage, así que
 *      moverse por la app —o recargar— no la vuelve a mostrar. Se
 *      repite recién en la próxima visita.
 *   2. NUNCA TAPA MÁS DE `TOPE_MS`. El video dura más que eso; la
 *      cortina se va igual, con un fundido, para que nadie espere para
 *      entrar. Tocando la pantalla también se salta.
 *   3. NO APARECE DONDE MOLESTA. En el enlace que abre el cliente
 *      (/p/<token>) no se muestra: esa persona viene a ver un
 *      presupuesto, no nuestra marca. Y si el sistema pide menos
 *      animación, tampoco.
 *
 * Si el video no puede reproducirse (conexión lenta, autoplay
 * bloqueado, códec), abajo está el logo quieto: se ve la marca igual y
 * la cortina se va con el mismo reloj.
 */
const VISTA = 'numera.intro.vista'
const TOPE_MS = 3000
const FUNDIDO_MS = 450

function debeMostrarse() {
  try {
    if (sessionStorage.getItem(VISTA) === '1') return false
    if (window.location.pathname.startsWith('/p/')) return false
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function IntroLogo() {
  const [montada, setMontada] = useState(debeMostrarse)
  const [saliendo, setSaliendo] = useState(false)
  const cerrado = useRef(false)

  useEffect(() => {
    if (!montada) return
    try {
      sessionStorage.setItem(VISTA, '1')
    } catch {
      // Navegador sin almacenamiento: la intro se repite. No es grave.
    }
    const tope = setTimeout(cerrar, TOPE_MS)
    return () => clearTimeout(tope)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montada])

  function cerrar() {
    if (cerrado.current) return
    cerrado.current = true
    setSaliendo(true)
    setTimeout(() => setMontada(false), FUNDIDO_MS)
  }

  if (!montada) return null

  return (
    <div
      onClick={cerrar}
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        // El fondo del video es casi blanco: si la cortina fuera del
        // color papel de la app se vería el recuadro alrededor.
        background: '#FBFBF9',
        opacity: saliendo ? 0 : 1,
        transition: `opacity ${FUNDIDO_MS}ms ease`
      }}
    >
      <img
        src="/numera-icon.png"
        alt="Numera"
        className="absolute h-28 w-28 object-contain opacity-90"
      />
      <video
        src="/logoanimado.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={cerrar}
        aria-hidden="true"
        className="relative max-h-[60vh] max-w-[80vw] object-contain"
      />
    </div>
  )
}
