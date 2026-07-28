import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { formatDate, formatMoney } from '../lib/utils'
import { PREMIUM_PRICE_FULL } from '../lib/config'

/**
 * Panel del dueño. Todo lo que se ve acá viene de RPC que primero
 * preguntan public.is_admin() en el servidor (migración 12): esta
 * pantalla no decide permisos, solo los muestra.
 */
export default function Admin() {
  const { isAdmin } = useAuth()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)
  const [log, setLog] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('resumen')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const cargar = useCallback(async (q = '') => {
    setError('')
    const [s, u, l] = await Promise.all([
      supabase.rpc('admin_stats'),
      supabase.rpc('admin_users', { p_search: q || null, p_limit: 100, p_offset: 0 }),
      supabase.rpc('admin_log', { p_limit: 50 })
    ])
    const err = s.error || u.error || l.error
    if (err) {
      setError(
        /no autorizado/i.test(err.message)
          ? 'Tu cuenta no tiene permisos de administrador.'
          : `No se pudo cargar: ${err.message}. ¿Ejecutaste la migración 12 en Supabase?`
      )
    }
    setStats(s.data || null)
    setUsers(u.data || null)
    setLog(l.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const buscar = async (e) => {
    e.preventDefault()
    setLoading(true)
    await cargar(search)
  }

  const darPremium = async (u) => {
    const meses = window.prompt(`¿Cuántos meses de premium para ${u.email}?`, '1')
    if (!meses) return
    setBusy(true)
    const { error: err } = await supabase.rpc('admin_grant_premium', {
      p_user: u.id,
      p_meses: Number(meses) || 1
    })
    if (err) window.alert(err.message)
    await cargar(search)
    setBusy(false)
  }

  const quitarPremium = async (u) => {
    if (!window.confirm(`¿Dar de baja la suscripción de ${u.email}?`)) return
    setBusy(true)
    const { error: err } = await supabase.rpc('admin_revoke_premium', { p_user: u.id })
    if (err) window.alert(err.message)
    await cargar(search)
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  if (!isAdmin || error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl2 border border-rust-500/40 bg-rust-500/[0.06] p-6 text-center">
        <p className="text-sm font-semibold text-ink">Panel no disponible</p>
        <p className="mt-1.5 text-sm text-ink-soft">
          {error || 'Tu cuenta no tiene permisos de administrador.'}
        </p>
      </div>
    )
  }

  const us = stats?.usuarios || {}
  const pl = stats?.planes || {}
  const pr = stats?.presupuestos || {}
  const inv = stats?.invitaciones || {}
  const cont = stats?.contenido || {}
  const promo = stats?.promo || {}

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Administración</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Datos de toda la app, en vivo. Solo vos ves esta pantalla.
          </p>
        </div>
        <button
          onClick={() => cargar(search)}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-faint"
        >
          ↻ Actualizar
        </button>
      </header>

      {promo.vigente && (
        <div className="mb-5 rounded-xl2 border border-brass-500/40 bg-brass-500/[0.08] px-4 py-3 text-sm text-ink-soft">
          ⏳ Etapa gratis vigente: nadie paga hasta el{' '}
          <b className="text-ink">{formatDate(String(promo.gratis_hasta).slice(0, 10))}</b> (faltan{' '}
          {promo.dias_restantes} días). El ingreso real de hoy es <b className="text-ink">USD 0</b>;
          las cuentas premium de abajo son activaciones manuales o premios por invitación.
        </div>
      )}

      {/* Pestañas */}
      <div className="mb-5 flex gap-1 border-b border-line">
        {[
          ['resumen', 'Resumen'],
          ['usuarios', `Usuarios (${users?.total ?? 0})`],
          ['movimientos', 'Movimientos']
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === k
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="space-y-6">
          <Bloque titulo="Usuarios">
            <Metrica label="Total registrados" valor={us.total} destacada />
            <Metrica label="Altas hoy" valor={us.hoy} />
            <Metrica label="Últimos 7 días" valor={us.ultimos_7} />
            <Metrica label="Últimos 30 días" valor={us.ultimos_30} />
            <Metrica label="Activos (7 días)" valor={us.activos_7} tono="teal" />
            <Metrica label="Activos (30 días)" valor={us.activos_30} tono="teal" />
            <Metrica
              label="Sin confirmar email"
              valor={us.sin_confirmar}
              tono={us.sin_confirmar > 0 ? 'brass' : undefined}
            />
            <Metrica label="Nunca entraron" valor={us.nunca_entraron} />
          </Bloque>

          <Bloque titulo="Planes y cobros">
            <Metrica label="Suscripciones activas" valor={pl.pagos} tono="teal" destacada />
            <Metrica
              label={`Ingreso mensual (a ${PREMIUM_PRICE_FULL})`}
              valor={promo.vigente ? 'USD 0' : `USD ${(pl.pagos || 0) * 2}`}
              tono="teal"
            />
            <Metrica label="En prueba" valor={pl.en_prueba} />
            <Metrica label="Vencidos / sin plan" valor={pl.vencidos} tono="rust" />
            <Metrica label="Vencen en 30 días" valor={pl.vencen_30} tono="brass" />
            <Metrica label="Premium por invitar" valor={pl.por_referido} />
          </Bloque>

          <Bloque titulo="Uso de la app">
            <Metrica label="Presupuestos" valor={pr.total} destacada />
            <Metrica label="Últimos 30 días" valor={pr.ultimos_30} />
            <Metrica label="Aceptados" valor={pr.aceptados} tono="teal" />
            <Metrica label="Rechazados" valor={pr.rechazados} tono="rust" />
            <Metrica label="Enviados / vistos" valor={pr.enviados} />
            <Metrica label="Borradores" valor={pr.borradores} />
            <Metrica label="Clientes cargados" valor={cont.clientes} />
            <Metrica label="Productos" valor={cont.productos} />
            <Metrica label="Comprobantes" valor={cont.facturas} />
          </Bloque>

          <div className="rounded-xl2 border border-line bg-surface p-5">
            <h2 className="font-display text-base font-medium text-ink">Volumen presupuestado</h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              Separado por moneda: sumar pesos con dólares daría un número sin sentido.
            </p>
            {(stats?.montos_por_moneda || []).length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">Todavía no hay presupuestos.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-faint">
                      <th className="pb-2 font-semibold">Moneda</th>
                      <th className="pb-2 text-right font-semibold">Presup.</th>
                      <th className="pb-2 text-right font-semibold">Emitido</th>
                      <th className="pb-2 text-right font-semibold">Aceptado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {stats.montos_por_moneda.map((m) => (
                      <tr key={m.moneda}>
                        <td className="py-2.5 font-medium text-ink">{m.moneda}</td>
                        <td className="py-2.5 text-right font-mono text-ink-soft">{m.cantidad}</td>
                        <td className="py-2.5 text-right font-mono text-ink-soft">
                          {formatMoney(m.emitido, m.moneda)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-medium text-teal-600">
                          {formatMoney(m.aceptado, m.moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Bloque titulo="Invitaciones">
            <Metrica label="Invitaciones totales" valor={inv.total} />
            <Metrica label="Confirmadas" valor={inv.confirmadas} tono="teal" />
            <Metrica label="Pendientes" valor={inv.pendientes} tono="brass" />
            <Metrica label="Premios otorgados" valor={inv.premios} destacada />
          </Bloque>

          <AltasPorDia datos={stats?.altas_por_dia || []} />
        </div>
      )}

      {tab === 'usuarios' && (
        <div>
          <form onSubmit={buscar} className="mb-4 flex gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por email, negocio o código de invitación..."
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:border-ink-faint"
            >
              Buscar
            </button>
          </form>

          <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
            {(users?.usuarios || []).length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-ink-soft">Sin resultados.</p>
            ) : (
              <ul className="divide-y divide-line">
                {users.usuarios.map((u) => (
                  <li key={u.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">
                            {u.business_name || 'Sin nombre'}
                          </p>
                          <EstadoPlan u={u} />
                          {!u.email_confirmado && (
                            <span className="rounded-full bg-brass-500/10 px-2 py-0.5 text-[11px] font-medium text-brass-600">
                              sin confirmar
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-ink-soft">{u.email}</p>
                        <p className="mt-1 text-xs text-ink-faint">
                          Alta {formatDate(u.created_at.slice(0, 10))} ·{' '}
                          {u.last_sign_in_at
                            ? `último ingreso ${formatDate(u.last_sign_in_at.slice(0, 10))}`
                            : 'nunca ingresó'}{' '}
                          · {u.presupuestos} presup. · {u.clientes} clientes · {u.facturas} comprob.
                        </p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          Código <span className="font-mono">{u.referral_code || '—'}</span> ·{' '}
                          {u.referidos}/3 invitados
                          {u.premio_referidos ? ' · premio cobrado' : ''}
                          {u.invitado_por ? ` · lo invitó ${u.invitado_por}` : ''}
                        </p>
                        {u.premium_until && (
                          <p className="mt-0.5 text-xs text-ink-faint">
                            Premium hasta {formatDate(u.premium_until.slice(0, 10))}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => darPremium(u)}
                          disabled={busy}
                          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-teal-500 hover:text-teal-600 disabled:opacity-50"
                        >
                          + Premium
                        </button>
                        {u.es_premium && (
                          <button
                            onClick={() => quitarPremium(u)}
                            disabled={busy}
                            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-rust-500 transition hover:border-rust-500 disabled:opacity-50"
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {users?.total > (users?.usuarios || []).length && (
            <p className="mt-3 text-xs text-ink-faint">
              Mostrando {users.usuarios.length} de {users.total}. Usá el buscador para acotar.
            </p>
          )}
        </div>
      )}

      {tab === 'movimientos' && (
        <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <p className="text-sm font-medium text-ink">Altas y bajas de suscripción</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              Cada activación manual queda registrada acá. Hasta que Stripe esté conectado, este es
              tu libro de cobros.
            </p>
          </div>
          {log.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-ink-soft">Todavía no hay movimientos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {log.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      {a.action === 'grant_premium' ? '✓ Alta premium' : '✗ Baja premium'} ·{' '}
                      <span className="font-mono text-xs text-ink-soft">{a.target_email}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatDate(a.created_at.slice(0, 10))} · por {a.admin_email}
                      {a.detail?.meses ? ` · ${a.detail.meses} mes(es)` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Bloque({ titulo, children }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-5">
      <h2 className="mb-4 font-display text-base font-medium text-ink">{titulo}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  )
}

function Metrica({ label, valor, tono, destacada }) {
  const color =
    tono === 'teal'
      ? 'text-teal-600'
      : tono === 'rust'
        ? 'text-rust-500'
        : tono === 'brass'
          ? 'text-brass-600'
          : destacada
            ? 'text-brand-600'
            : 'text-ink'
  return (
    <div className="rounded-xl2 border border-line bg-paper/50 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{valor ?? 0}</p>
    </div>
  )
}

function EstadoPlan({ u }) {
  if (u.es_premium) {
    return (
      <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-600">
        premium
      </span>
    )
  }
  if (u.en_prueba) {
    return (
      <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-600">
        prueba
      </span>
    )
  }
  return (
    <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-medium text-ink-faint">
      free
    </span>
  )
}

function AltasPorDia({ datos }) {
  if (datos.length === 0) return null
  const max = Math.max(...datos.map((d) => d.altas), 1)
  return (
    <div className="rounded-xl2 border border-line bg-surface p-5">
      <h2 className="font-display text-base font-medium text-ink">Altas de las últimas 4 semanas</h2>
      <div className="mt-4 flex h-32 items-end gap-1">
        {datos.map((d) => (
          <div key={d.dia} className="group flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-ink-faint opacity-0 transition group-hover:opacity-100">
              {d.altas}
            </span>
            <div
              className="w-full rounded-t bg-gradient-to-t from-brand-600 to-teal-500"
              style={{ height: `${Math.max(4, (d.altas / max) * 100)}%` }}
              title={`${d.dia}: ${d.altas}`}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Pasá el mouse por cada barra para ver el día y la cantidad.
      </p>
    </div>
  )
}
