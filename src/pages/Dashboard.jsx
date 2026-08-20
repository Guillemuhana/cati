import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import PrimerosPasos from '../components/PrimerosPasos'
import InvitarDestacado from '../components/InvitarDestacado'
import BienvenidaModal from '../components/BienvenidaModal'
import { formatMoney, formatDate, formatNumero } from '../lib/utils'
import { CLAVES, marcar, estaMarcado } from '../lib/onboarding'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  // Si lo saltó, no se lo volvemos a poner adelante en cada recarga: la
  // tarjeta de primeros pasos ya lo lleva al mismo lugar.
  const [saltoBienvenida, setSaltoBienvenida] = useState(() =>
    estaMarcado(CLAVES.bienvenidaSaltada)
  )

  // Primera vez: el negocio todavía no tiene nombre.
  const mostrarBienvenida = !!profile && !profile.business_name && !saltoBienvenida

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    supabase
      .from('budgets')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setBudgets(data || [])
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [user])

  const stats = useMemo(() => {
    const total = budgets.length
    const aprobados = budgets.filter((b) => b.status === 'aprobado' || b.status === 'aceptado')
    const enviados = budgets.filter((b) => b.status === 'enviado')
    const montoAprobado = aprobados.reduce((acc, b) => acc + Number(b.total || 0), 0)
    const montoPendiente = enviados.reduce((acc, b) => acc + Number(b.total || 0), 0)
    return { total, aprobados: aprobados.length, enviados: enviados.length, montoAprobado, montoPendiente }
  }, [budgets])

  const recientes = budgets.slice(0, 6)
  const firstName = profile?.business_name?.split(' ')[0]

  return (
    <div>
      {mostrarBienvenida && (
        <BienvenidaModal
          onListo={() => setSaltoBienvenida(true)}
          onSaltar={() => {
            marcar(CLAVES.bienvenidaSaltada)
            setSaltoBienvenida(true)
          }}
        />
      )}

      <header className="mb-8">
        <h1 className="font-display text-3xl font-medium text-ink">
          Hola
          {firstName && (
            <span className="bg-gradient-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">
              , {firstName}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">Así viene tu actividad con Numera.</p>
      </header>

      <PrimerosPasos budgets={budgets} cargando={loading} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Presupuestos" value={stats.total} tone="navy" />
        <StatCard label="Enviados" value={stats.enviados} tone="blue" hint={formatMoney(stats.montoPendiente, profile?.currency)} />
        <StatCard label="Aprobados" value={stats.aprobados} tone="teal" hint={formatMoney(stats.montoAprobado, profile?.currency)} />
        <StatCard label="Moneda" value={profile?.currency || 'ARS'} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-xl font-medium text-ink">Actividad reciente</h2>
        <Link to="/presupuestos/nuevo" className="text-sm font-medium text-brand-600 hover:underline">
          + Nuevo presupuesto
        </Link>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl2 border border-line bg-surface">
        {loading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : recientes.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-line">
            {recientes.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/presupuestos/${b.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-brand-500/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {b.title || b.clients?.name || formatNumero(b.numero, b.issue_date, profile?.number_prefix)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {formatNumero(b.numero, b.issue_date, profile?.number_prefix)} · {b.clients?.name || 'Sin cliente'} · {formatDate(b.issue_date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm text-ink">{formatMoney(b.total, b.currency)}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <InvitarDestacado />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="font-display text-lg text-ink">Todavía no armaste presupuestos</p>
      <p className="mt-1 max-w-xs text-sm text-ink-soft">
        Creá el primero y compartilo en PDF con tu cliente en menos de dos minutos.
      </p>
      <Link
        to="/presupuestos/nuevo"
        className="mt-5 rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Crear presupuesto
      </Link>
    </div>
  )
}
