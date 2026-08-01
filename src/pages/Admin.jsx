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
  const [abierto, setAbierto] = useState(null) // id del usuario con la ficha abierta
  const [detalle, setDetalle] = useState(null)
  const [regalo, setRegalo] = useState(null) // usuario al que se le va a regalar

  // Actividad: se carga aparte y solo al abrir la pestaña. Es la consulta
  // más pesada del panel y no tiene sentido pagarla en cada visita a /admin.
  const [actividad, setActividad] = useState(null)
  const [actDias, setActDias] = useState(7)
  const [actCargando, setActCargando] = useState(false)
  const [actError, setActError] = useState('')

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

  const cargarActividad = useCallback(async (dias) => {
    setActCargando(true)
    setActError('')
    const { data, error: err } = await supabase.rpc('admin_actividad', {
      p_days: dias,
      p_limit: 200
    })
    if (err) {
      setActError(
        /no autorizado/i.test(err.message)
          ? 'Tu cuenta no tiene permisos de administrador.'
          : `${err.message}. ¿Ejecutaste la migración 16 en Supabase?`
      )
      setActividad(null)
    } else {
      setActividad(data)
    }
    setActCargando(false)
  }, [])

  useEffect(() => {
    if (tab === 'actividad') cargarActividad(actDias)
  }, [tab, actDias, cargarActividad])

  const buscar = async (e) => {
    e.preventDefault()
    setLoading(true)
    await cargar(search)
  }

  const regalar = async (u, meses, motivo) => {
    setBusy(true)
    const { error: err } = await supabase.rpc('admin_grant_premium', {
      p_user: u.id,
      p_meses: meses,
      p_motivo: motivo || null
    })
    if (err) window.alert(err.message)
    setRegalo(null)
    await cargar(search)
    setBusy(false)
  }

  // La ficha se pide recién al abrirla: trae las conexiones con IP, que
  // son caras de consultar y no tiene sentido buscarlas para 100 filas.
  const abrirFicha = async (u) => {
    if (abierto === u.id) {
      setAbierto(null)
      return
    }
    setAbierto(u.id)
    setDetalle(null)
    const { data, error: err } = await supabase.rpc('admin_user_detail', { p_user: u.id })
    if (err) {
      setDetalle({ error: err.message })
      return
    }
    setDetalle(data)
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
          ['actividad', 'Actividad'],
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
                          {u.origen === 'invitación' && (
                            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                              🎁 invitado
                            </span>
                          )}
                          {u.regalos > 0 && (
                            <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-600">
                              {u.regalos} regalo{u.regalos > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-ink-soft">{u.email}</p>

                        {/* Quién es y de dónde */}
                        <p className="mt-1 text-xs text-ink-soft">
                          {[
                            u.address,
                            u.phone,
                            u.tax_id ? `CUIT ${u.tax_id}` : null,
                            paisPorMoneda(u.currency)
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Todavía no completó los datos de su negocio'}
                        </p>

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
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          onClick={() => abrirFicha(u)}
                          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink"
                        >
                          {abierto === u.id ? 'Cerrar ficha' : 'Ver ficha'}
                        </button>
                        <button
                          onClick={() => setRegalo(u)}
                          disabled={busy}
                          className="rounded-md border border-teal-500/40 bg-teal-500/[0.06] px-3 py-1.5 text-xs font-medium text-teal-600 transition hover:bg-teal-500/[0.12] disabled:opacity-50"
                        >
                          🎁 Regalar meses
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

                    {abierto === u.id && <Ficha detalle={detalle} />}
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

      {tab === 'actividad' && (
        <div className="space-y-5">
          {/* Ventana de tiempo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-faint">Ver los últimos</span>
            {[1, 7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setActDias(d)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  actDias === d
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-line text-ink-soft hover:text-ink'
                }`}
              >
                {d === 1 ? '24 horas' : `${d} días`}
              </button>
            ))}
            {actCargando && <Spinner />}
          </div>

          {actError && (
            <p className="rounded-xl2 border border-rust-500/40 bg-rust-500/[0.06] px-4 py-3 text-xs text-rust-500">
              {actError}
            </p>
          )}

          {actividad && (
            <>
              <Bloque titulo={`Resumen de ${actDias === 1 ? 'las últimas 24 horas' : `los últimos ${actDias} días`}`}>
                <Metrica label="Ingresos" valor={actividad.resumen?.ingresos ?? 0} destacada />
                <Metrica label="Altas nuevas" valor={actividad.resumen?.altas ?? 0} tono="teal" />
                <Metrica label="Presupuestos" valor={actividad.resumen?.presupuestos ?? 0} />
                <Metrica label="Aceptados" valor={actividad.resumen?.aceptados ?? 0} tono="teal" />
                <Metrica
                  label="Usuarios que armaron algo"
                  valor={actividad.resumen?.usuarios_activos ?? 0}
                />
              </Bloque>

              <IngresosPorDia datos={actividad.por_dia || []} />

              <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
                <div className="border-b border-line px-5 py-3">
                  <p className="text-sm font-medium text-ink">Línea de tiempo</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    Quién entró, quién se registró y qué presupuestos se armaron, del más reciente al
                    más viejo.
                  </p>
                </div>
                {(actividad.eventos || []).length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-ink-soft">
                    Sin actividad en este período.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {actividad.eventos.map((e, n) => (
                      <Evento key={n} e={e} />
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-ink-faint">
                Los ingresos salen del registro de auth de Supabase, que se purga solo cada pocas
                semanas: no sirve como historial largo. Si la lista aparece sin ingresos pero sí con
                altas y presupuestos, es que el registro de auth no está disponible — el resto de los
                datos igual es correcto.
              </p>
            </>
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
                      {a.detail?.motivo ? ` · "${a.detail.motivo}"` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {regalo && (
        <ModalRegalo
          usuario={regalo}
          busy={busy}
          onCerrar={() => setRegalo(null)}
          onConfirmar={(meses, motivo) => regalar(regalo, meses, motivo)}
        />
      )}
    </div>
  )
}

/** País probable a partir de la moneda que eligió el usuario. Es una
 *  pista, no un dato: alguien en España puede facturar en dólares. */
function paisPorMoneda(cur) {
  const mapa = {
    ARS: '🇦🇷 Argentina',
    UYU: '🇺🇾 Uruguay',
    CLP: '🇨🇱 Chile',
    MXN: '🇲🇽 México',
    BRL: '🇧🇷 Brasil',
    EUR: '🇪🇺 Zona euro',
    USD: '💵 USD'
  }
  return mapa[cur] || cur || null
}

/** Ficha completa. Se pide al servidor al abrirla. */
function Ficha({ detalle }) {
  if (!detalle) {
    return (
      <div className="mt-4 flex justify-center rounded-xl2 border border-line bg-paper/50 py-8">
        <Spinner />
      </div>
    )
  }
  if (detalle.error) {
    return (
      <p className="mt-4 rounded-xl2 border border-rust-500/40 bg-rust-500/[0.06] px-4 py-3 text-xs text-rust-500">
        {detalle.error} · ¿Ejecutaste la migración 13?
      </p>
    )
  }

  const p = detalle.perfil || {}
  const act = detalle.actividad || {}
  const otros = detalle.otros || {}

  return (
    <div className="mt-4 space-y-4 rounded-xl2 border border-line bg-paper/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Titulo>Datos del negocio</Titulo>
          <Dato label="Negocio" valor={p.business_name} />
          <Dato label="Email de la cuenta" valor={p.email} mono />
          <Dato label="Email de contacto" valor={p.contacto_email} mono />
          <Dato label="Teléfono" valor={p.phone} />
          <Dato label="Dirección" valor={p.address} />
          <Dato label="CUIT / ID fiscal" valor={p.tax_id} />
          <Dato label="Moneda" valor={paisPorMoneda(p.currency)} />
          <Dato label="Datos bancarios" valor={p.bank_alias} />
          <Dato label="Prefijo" valor={p.number_prefix} />
        </div>

        <div>
          <Titulo>Cuenta</Titulo>
          <Dato label="Alta" valor={p.created_at && formatDate(p.created_at.slice(0, 10))} />
          <Dato
            label="Último ingreso"
            valor={p.last_sign_in_at ? formatDate(p.last_sign_in_at.slice(0, 10)) : 'nunca'}
          />
          <Dato label="Email confirmado" valor={p.email_confirmado ? 'sí' : 'NO'} />
          <Dato label="Plan" valor={p.plan} />
          <Dato
            label="Prueba hasta"
            valor={p.trial_ends_at && formatDate(p.trial_ends_at.slice(0, 10))}
          />
          <Dato
            label="Premium hasta"
            valor={p.premium_until && formatDate(p.premium_until.slice(0, 10))}
          />
          <Dato label="Su código" valor={p.referral_code} mono />
          <Dato label="Lo invitó" valor={p.invitado_por} mono />
        </div>
      </div>

      <div>
        <Titulo>Actividad</Titulo>
        <p className="text-xs text-ink-soft">
          {act.presupuestos || 0} presupuestos ({act.ultimos_30 || 0} en los últimos 30 días) ·{' '}
          {act.aceptados || 0} aceptados · {otros.clientes || 0} clientes · {otros.productos || 0}{' '}
          productos · {otros.facturas || 0} comprobantes
        </p>
        {act.primer_presupuesto && (
          <p className="mt-1 text-xs text-ink-faint">
            Primero el {formatDate(act.primer_presupuesto.slice(0, 10))} · último el{' '}
            {formatDate(act.ultimo_presupuesto.slice(0, 10))}
          </p>
        )}
        {(detalle.montos || []).length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {detalle.montos.map((m) => (
              <li key={m.moneda} className="font-mono text-xs text-ink-soft">
                {m.moneda}: emitido {formatMoney(m.emitido, m.moneda)} · aceptado{' '}
                <span className="text-teal-600">{formatMoney(m.aceptado, m.moneda)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(detalle.invitados || []).length > 0 && (
        <div>
          <Titulo>A quiénes invitó</Titulo>
          <ul className="space-y-0.5">
            {detalle.invitados.map((i, n) => (
              <li key={n} className="text-xs text-ink-soft">
                <span className="font-mono">{i.email}</span> ·{' '}
                <span className={i.estado === 'confirmado' ? 'text-teal-600' : 'text-brass-600'}>
                  {i.estado}
                </span>{' '}
                · {formatDate(i.fecha.slice(0, 10))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(detalle.movimientos || []).length > 0 && (
        <div>
          <Titulo>Regalos y bajas de esta cuenta</Titulo>
          <ul className="space-y-0.5">
            {detalle.movimientos.map((m, n) => (
              <li key={n} className="text-xs text-ink-soft">
                {m.accion === 'grant_premium' ? '🎁' : '✗'} {formatDate(m.fecha.slice(0, 10))}
                {m.detail?.meses ? ` · ${m.detail.meses} mes(es)` : ''}
                {m.detail?.motivo ? ` · "${m.detail.motivo}"` : ''} · por {m.admin}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Titulo>Últimas conexiones</Titulo>
        {(detalle.conexiones || []).length === 0 ? (
          <p className="text-xs text-ink-faint">Sin registro de conexiones.</p>
        ) : (
          <ul className="space-y-0.5">
            {detalle.conexiones.map((c, n) => (
              <li key={n} className="font-mono text-xs text-ink-soft">
                {formatDate(String(c.fecha).slice(0, 10))} · {c.accion || '—'} · {c.ip || 'sin IP'}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-ink-faint">
          La IP sirve para detectar a alguien creando varias cuentas desde la misma conexión. Es
          dato personal de tus usuarios: no lo compartas fuera de acá.
        </p>
      </div>
    </div>
  )
}

function Titulo({ children }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
      {children}
    </p>
  )
}

function Dato({ label, valor, mono }) {
  if (!valor) return null
  return (
    <p className="text-xs text-ink-soft">
      <span className="text-ink-faint">{label}:</span>{' '}
      <span className={mono ? 'font-mono text-ink' : 'text-ink'}>{valor}</span>
    </p>
  )
}

/** Ventana para regalar meses con un motivo. */
function ModalRegalo({ usuario, onCerrar, onConfirmar, busy }) {
  const [meses, setMeses] = useState(3)
  const [motivo, setMotivo] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onCerrar} />
      <div className="relative w-full max-w-md rounded-xl2 border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-medium text-ink">Regalar meses de premium</h2>
        <p className="mt-1 text-sm text-ink-soft">
          A <b className="text-ink">{usuario.business_name || 'Sin nombre'}</b>
          <br />
          <span className="font-mono text-xs">{usuario.email}</span>
        </p>
        {usuario.premium_until && (
          <p className="mt-2 text-xs text-ink-faint">
            Ya tiene premium hasta el {formatDate(usuario.premium_until.slice(0, 10))}. Los meses
            nuevos se suman a esa fecha, no la pisan.
          </p>
        )}

        <p className="mt-4 mb-2 text-sm font-medium text-ink">¿Cuántos meses?</p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 3, 6, 12, 24].map((m) => (
            <button
              key={m}
              onClick={() => setMeses(m)}
              className={`rounded-md border py-2 text-sm font-semibold transition ${
                meses === m
                  ? 'border-teal-500 bg-teal-500/10 text-teal-600'
                  : 'border-line text-ink-soft hover:border-ink-faint'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Motivo (opcional)</span>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            placeholder="Ej: usuario fundador, compensación, sorteo"
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink-faint">
            Queda en el historial y <b>se lo mostramos al usuario</b> en el aviso, así que escribilo
            pensando en que lo va a leer él.
          </span>
        </label>

        <p className="mt-3 rounded-md bg-teal-500/[0.07] px-3 py-2 text-xs text-ink-soft">
          🔔 Le va a aparecer un cartel con el regalo la próxima vez que entre a la app, y le queda
          el aviso en la campanita.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onConfirmar(meses, motivo)}
            disabled={busy}
            className="btn-primary flex-1 rounded-md py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? 'Regalando...' : `Regalar ${meses} ${meses === 1 ? 'mes' : 'meses'}`}
          </button>
          <button
            onClick={onCerrar}
            className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-soft"
          >
            Cancelar
          </button>
        </div>
      </div>
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

function IngresosPorDia({ datos }) {
  if (datos.length === 0) return null
  const max = Math.max(...datos.map((d) => d.ingresos), 1)
  return (
    <div className="rounded-xl2 border border-line bg-surface p-5">
      <h2 className="font-display text-base font-medium text-ink">Ingresos por día</h2>
      <p className="mt-0.5 text-xs text-ink-faint">
        Barra llena: cuántas veces se entró. El número de abajo son personas distintas.
      </p>
      <div className="mt-4 flex h-28 items-end gap-1">
        {datos.map((d) => (
          <div key={d.dia} className="group flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-ink-faint opacity-0 transition group-hover:opacity-100">
              {d.ingresos}
            </span>
            <div
              className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-300"
              style={{ height: `${Math.max(4, (d.ingresos / max) * 100)}%` }}
              title={`${d.dia}: ${d.ingresos} ingresos · ${d.usuarios} usuarios`}
            />
            <span className="text-[9px] tabular-nums text-ink-faint">{d.usuarios || ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Una fila del feed. El tipo define ícono, color y qué se cuenta.
function Evento({ e }) {
  const cfg = {
    ingreso: { icono: '→', color: 'text-brand-600', texto: 'entró a la app' },
    alta: { icono: '★', color: 'text-teal-600', texto: 'creó su cuenta' },
    presupuesto: { icono: '▤', color: 'text-brass-600', texto: 'armó un presupuesto' }
  }[e.tipo] || { icono: '·', color: 'text-ink-faint', texto: e.tipo }

  const d = e.detalle

  return (
    <li className="flex items-start gap-3 px-5 py-2.5">
      <span className={`mt-0.5 w-4 shrink-0 text-center text-sm ${cfg.color}`}>{cfg.icono}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">
          <span className="font-medium">{e.negocio || e.email || 'usuario'}</span>{' '}
          <span className="text-ink-soft">{cfg.texto}</span>
          {d && (
            <span className="text-ink-soft">
              {' '}
              · {formatMoney(d.total, d.moneda)}{' '}
              <span className="text-ink-faint">({d.estado})</span>
            </span>
          )}
        </p>
        {e.negocio && e.email && (
          <p className="truncate font-mono text-[11px] text-ink-faint">{e.email}</p>
        )}
      </div>
      <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-ink-faint">
        {formatFechaHora(e.fecha)}
      </span>
    </li>
  )
}

// Fecha corta con hora: en un feed de actividad la hora es la mitad del dato.
function formatFechaHora(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const hoy = new Date()
  const mismoDia =
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear()
  const hora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(d)
  if (mismoDia) return `hoy ${hora}`
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(d)
  return `${fecha} ${hora}`
}
