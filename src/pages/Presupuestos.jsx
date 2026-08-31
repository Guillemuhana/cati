import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { classNames, formatDate, formatMoney, formatNumero } from '../lib/utils'

// Claves del catálogo: el rótulo se resuelve al dibujar.
const FILTERS = [
  { key: 'todos', label: 'estados.todos' },
  { key: 'enviado', label: 'estados.enviado' },
  { key: 'visto', label: 'estados.visto' },
  { key: 'aceptado', label: 'estados.aceptado' },
  { key: 'rechazado', label: 'estados.rechazado' },
  { key: 'vencido', label: 'estados.vencido' }
]

export default function Presupuestos() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos')
  const [query, setQuery] = useState('')

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

  const filtered = useMemo(() => {
    return budgets.filter((b) => {
      const matchesFilter =
        filter === 'todos' || b.status === filter || (filter === 'aceptado' && b.status === 'aprobado')
      const q = query.toLowerCase()
      const matchesQuery =
        !q ||
        b.title?.toLowerCase().includes(q) ||
        b.clients?.name?.toLowerCase().includes(q) ||
        formatNumero(b.numero, b.issue_date, profile?.number_prefix).toLowerCase().includes(q)
      return matchesFilter && matchesQuery
    })
  }, [budgets, filter, query])

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">{t('presupuestos.titulo')}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t('presupuestos.bajada')}</p>
        </div>
        <Link
          to="/presupuestos/nuevo"
          className="btn-primary inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
        >
          {t('panel.nuevoPresupuesto')}
        </Link>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={classNames(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                filter === f.key
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-line text-ink-soft hover:border-ink-faint'
              )}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder={t('presupuestos.buscar')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-md border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none sm:w-64"
        />
      </div>

      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {loading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-soft">{t('presupuestos.sinResultados')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((b) => (
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
                      {formatNumero(b.numero, b.issue_date, profile?.number_prefix)} · {b.clients?.name || t('panel.sinCliente')} · {formatDate(b.issue_date)}
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
    </div>
  )
}
