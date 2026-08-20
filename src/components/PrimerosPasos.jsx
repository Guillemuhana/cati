import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { CLAVES, marcar, estaMarcado } from '../lib/onboarding'

/**
 * La guía de arranque del panel.
 *
 * Cada paso se marca solo mirando los datos de verdad: no hay una
 * columna «onboarding_step» que se pueda desincronizar de la realidad
 * ni una migración nueva que correr. Si el usuario ya hizo algo antes
 * de que existiera esta tarjeta, le aparece hecho.
 *
 * Cuando están los cinco, la tarjeta desaparece sola.
 */
export default function PrimerosPasos({ budgets = [], cargando = false }) {
  const { user, profile } = useAuth()
  const [clientes, setClientes] = useState(null)
  const [oculta, setOculta] = useState(() => estaMarcado(CLAVES.pasosOcultos))

  useEffect(() => {
    if (!user) return
    let activo = true
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => activo && setClientes(count || 0))
    return () => {
      activo = false
    }
  }, [user])

  // Que lo mandó lo sabemos de dos maneras: porque el cliente abrió el
  // enlace (eso lo escribe la base), o porque el usuario ya usó el botón
  // de compartir alguna vez. Por el estado no alcanza: los presupuestos
  // nacen en «enviado», así que se marcaría solo al crear el primero.
  const compartido =
    estaMarcado(CLAVES.yaCompartio) ||
    budgets.some((b) => b.viewed_at || ['visto', 'aceptado', 'rechazado'].includes(b.status))

  const pasos = [
    {
      titulo: 'Poné el nombre de tu negocio',
      detalle: 'Es lo que el cliente lee arriba del presupuesto.',
      hecho: !!profile?.business_name,
      a: '/perfil',
      cta: 'Completar'
    },
    {
      titulo: 'Subí tu logo',
      detalle: 'Sale en el PDF y en la vista previa del link.',
      hecho: !!profile?.logo_url,
      a: '/perfil',
      cta: 'Subir logo'
    },
    {
      titulo: 'Cargá tu primer cliente',
      detalle: 'Con el nombre alcanza; el teléfono te sirve para mandarle el presupuesto.',
      hecho: (clientes ?? 0) > 0,
      a: '/clientes',
      cta: 'Cargar cliente'
    },
    {
      titulo: 'Armá tu primer presupuesto',
      detalle: 'Ítems, cantidades y precio: los totales se calculan solos.',
      hecho: budgets.length > 0,
      a: '/presupuestos/nuevo',
      cta: 'Crear'
    },
    {
      titulo: 'Mandáselo al cliente',
      detalle: 'Por WhatsApp, email o PDF, desde el botón «Compartir».',
      hecho: compartido,
      a: budgets[0] ? `/presupuestos/${budgets[0].id}` : '/presupuestos',
      cta: 'Compartir'
    }
  ]

  const hechos = pasos.filter((p) => p.hecho).length
  const siguiente = pasos.find((p) => !p.hecho)

  // Mientras no sepamos si tiene clientes, no dibujamos nada: es peor
  // mostrar un paso «pendiente» que ya estaba hecho.
  if (oculta || cargando || clientes === null || !siguiente) return null

  const esconder = () => {
    marcar(CLAVES.pasosOcultos)
    setOculta(true)
  }

  return (
    <section className="mb-8 overflow-hidden rounded-xl2 border border-brand-500/25 bg-gradient-to-br from-brand-500/[0.07] to-teal-500/[0.05] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">Primeros pasos</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Cinco cosas cortas y tu negocio queda listo para presupuestar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-sm text-ink-soft">
            <span className="text-lg font-semibold text-brand-600">{hechos}</span> de {pasos.length}
          </p>
          <button
            onClick={esconder}
            aria-label="Ocultar primeros pasos"
            className="rounded-md p-1 text-ink-faint transition hover:bg-ink/5 hover:text-ink-soft"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-teal-500 transition-all duration-500"
          style={{ width: `${(hechos / pasos.length) * 100}%` }}
        />
      </div>

      <ol className="mt-4 space-y-1.5">
        {pasos.map((p) => {
          const esSiguiente = p === siguiente
          return (
            <li
              key={p.titulo}
              className={`flex items-center gap-3 rounded-xl2 px-3 py-2.5 transition ${
                esSiguiente ? 'border border-line bg-surface shadow-soft' : ''
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  p.hecho
                    ? 'border-teal-500/40 bg-teal-500/15 text-teal-600'
                    : esSiguiente
                      ? 'border-brand-500 text-brand-600'
                      : 'border-line text-ink-faint'
                }`}
              >
                {p.hecho ? '✓' : ''}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    p.hecho ? 'text-ink-faint line-through' : 'text-ink'
                  }`}
                >
                  {p.titulo}
                </p>
                {esSiguiente && <p className="mt-0.5 text-xs text-ink-soft">{p.detalle}</p>}
              </div>
              {esSiguiente && (
                <Link
                  to={p.a}
                  className="btn-primary shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold"
                >
                  {p.cta}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
