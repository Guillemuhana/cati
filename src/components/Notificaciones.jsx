import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'

/**
 * Campanita con los avisos del usuario (migración 14).
 * Los avisos los escribe el servidor: acá solo se leen y se marcan como
 * vistos. Un regalo de meses premium aparece además como cartelito
 * grande la primera vez, para que no pase desapercibido.
 */
// Avisos que además se muestran en grande la primera vez.
const DESTACABLES = ['regalo', 'presupuesto']

// El canal necesita un nombre distinto en cada suscripción: supabase
// reutiliza el canal si el nombre ya existe, y agregarle un listener a uno
// que ya está suscrito explota. Pasa siempre, porque la campanita se dibuja
// dos veces (sidebar y topbar), y también en el remonte de StrictMode,
// donde el canal viejo todavía no terminó de irse.
let nroDeCanal = 0

export default function Notificaciones() {
  const { user, refreshProfile } = useAuth()
  const [items, setItems] = useState([])
  const [abierto, setAbierto] = useState(false)
  const [destacado, setDestacado] = useState(null)
  const ref = useRef(null)

  const sinLeer = items.filter((n) => !n.read_at).length

  useEffect(() => {
    if (!user) return
    let activo = true
    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        // Si falta la migración 14, la campanita simplemente no aparece.
        if (!activo || error) return
        setItems(data || [])
        // Lo que no puede pasar desapercibido se muestra en grande una
        // sola vez: un regalo de meses, y que el cliente haya respondido
        // un presupuesto.
        const fuerte = (data || []).find((n) => !n.read_at && DESTACABLES.includes(n.tipo))
        if (fuerte) {
          setDestacado(fuerte)
          // El premium recién otorgado tiene que reflejarse en el plan.
          if (fuerte.tipo === 'regalo') refreshProfile()
        }
      })
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Que el aviso llegue solo, sin recargar: cuando el cliente acepta el
  // presupuesto, el que lo mandó suele tener la app abierta esperando.
  // La migración 23 pone la tabla en la publicación de realtime; si en
  // el proyecto no está habilitada, esto simplemente no dispara nunca y
  // el aviso aparece igual al recargar.
  useEffect(() => {
    if (!user) return
    let canal
    // Si armar el canal falla, que se pierda el aviso en vivo y nada más:
    // esto es una comodidad, y una excepción acá se lleva puesta la
    // pantalla entera porque cae en el ErrorBoundary.
    try {
      canal = supabase
        .channel(`avisos-${user.id}-${++nroDeCanal}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          ({ new: aviso }) => {
            setItems((prev) => (prev.some((n) => n.id === aviso.id) ? prev : [aviso, ...prev]))
            if (DESTACABLES.includes(aviso.tipo)) setDestacado(aviso)
          }
        )
        .subscribe()
    } catch (e) {
      console.warn('Avisos en vivo desactivados:', e?.message || e)
    }
    return () => {
      if (canal) supabase.removeChannel(canal)
    }
  }, [user])

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const marcarLeidos = async () => {
    if (sinLeer === 0) return
    await supabase.rpc('notifications_mark_read')
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
  }

  const abrir = () => {
    const nuevo = !abierto
    setAbierto(nuevo)
    if (nuevo) marcarLeidos()
  }

  const cerrarDestacado = async () => {
    setDestacado(null)
    await marcarLeidos()
  }

  if (items.length === 0) return null

  return (
    <>
      {/* Cartelito grande para el regalo, una sola vez */}
      {destacado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40" onClick={cerrarDestacado} />
          <div
            className={`relative w-full max-w-sm rounded-xl2 border bg-surface p-6 text-center shadow-soft ${
              destacado.icono === '❌' ? 'border-line' : 'border-teal-500/30'
            }`}
          >
            <p className="text-5xl">{destacado.icono || '🎁'}</p>
            <h2 className="mt-3 font-display text-xl font-medium text-ink">{destacado.titulo}</h2>
            {destacado.cuerpo && <p className="mt-2 text-sm text-ink-soft">{destacado.cuerpo}</p>}
            <button
              onClick={cerrarDestacado}
              className="btn-primary mt-5 w-full rounded-md py-2.5 text-sm font-semibold"
            >
              {destacado.tipo === 'regalo' ? '¡Gracias!' : 'Buenísimo'}
            </button>
          </div>
        </div>
      )}

      <div className="relative" ref={ref}>
        <button
          onClick={abrir}
          aria-label={sinLeer > 0 ? `${sinLeer} avisos sin leer` : 'Avisos'}
          className="relative rounded-lg border border-line p-2 text-ink-soft transition hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
            <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
            <path d="M10.3 20a2 2 0 0 0 3.4 0" strokeLinecap="round" />
          </svg>
          {sinLeer > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rust-500 px-1 text-[10px] font-semibold text-white">
              {sinLeer}
            </span>
          )}
        </button>

        {abierto && (
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl2 border border-line bg-surface shadow-soft">
            <p className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Avisos
            </p>
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <span className="text-lg leading-none">{n.icono || '🔔'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{n.titulo}</p>
                    {n.cuerpo && <p className="mt-0.5 text-xs text-ink-soft">{n.cuerpo}</p>}
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {formatDate(n.created_at.slice(0, 10))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}
