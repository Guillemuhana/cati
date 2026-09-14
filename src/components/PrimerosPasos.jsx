import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      clave: 'negocio',
      hecho: !!profile?.business_name,
      a: '/perfil'
    },
    {
      clave: 'logo',
      hecho: !!profile?.logo_url,
      a: '/perfil'
    },
    {
      clave: 'cliente',
      hecho: (clientes ?? 0) > 0,
      a: '/clientes'
    },
    {
      clave: 'presupuesto',
      hecho: budgets.length > 0,
      a: '/presupuestos/nuevo'
    },
    {
      clave: 'compartir',
      hecho: compartido,
      a: budgets[0] ? `/presupuestos/${budgets[0].id}` : '/presupuestos'
    }
  ].map((p) => ({
    ...p,
    titulo: t(`pasos.${p.clave}.titulo`),
    detalle: t(`pasos.${p.clave}.detalle`),
    cta: t(`pasos.${p.clave}.cta`)
  }))

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
    <section className="mb-8 overflow-hidden rounded-xl2 border border-brand-500/25 bg-gradient-to-br from-brand-500/[0.07] to-brass-400/[0.10] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t('pasos.titulo')}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{t('pasos.bajada')}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-sm text-ink-soft">
            <span className="text-lg font-semibold text-brand-600">{hechos}</span>{' '}
            {t('pasos.de', { total: pasos.length })}
          </p>
          <button
            onClick={esconder}
            aria-label={t('pasos.ocultar')}
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
          className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brass-500 transition-all duration-500"
          style={{ width: `${(hechos / pasos.length) * 100}%` }}
        />
      </div>

      <ol className="mt-4 space-y-1.5">
        {pasos.map((p) => {
          const esSiguiente = p === siguiente
          return (
            <li
              key={p.clave}
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
