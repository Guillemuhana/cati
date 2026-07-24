import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/StatCard'
import Card from '../components/Card'
import Spinner from '../components/Spinner'
import { formatMoney, formatDate, formatNumero, STATUS } from '../lib/utils'

const ACCEPTED = ['aceptado', 'aprobado']

export default function Reportes() {
  const { user, profile } = useAuth()
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('budgets')
      .select('*, clients(name)')
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setBudgets(data || [])
        setLoading(false)
      })
  }, [user])

  const stats = useMemo(() => {
    const total = budgets.length
    const enviados = budgets.filter((b) => b.status !== 'borrador')
    const aceptados = budgets.filter((b) => ACCEPTED.includes(b.status))
    const montoAceptado = aceptados.reduce((a, b) => a + Number(b.total || 0), 0)
    const montoTotal = budgets.reduce((a, b) => a + Number(b.total || 0), 0)
    const tasa = enviados.length ? Math.round((aceptados.length / enviados.length) * 100) : 0

    // Últimos 6 meses (monto aceptado por mes)
    const months = []
    const now = new Date(budgets[0]?.issue_date || Date.now())
    const ref = new Date(now.getFullYear(), now.getMonth(), 1)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(d)
      const monto = aceptados
        .filter((b) => (b.issue_date || '').slice(0, 7) === key)
        .reduce((a, b) => a + Number(b.total || 0), 0)
      months.push({ key, label, monto })
    }
    const maxMonth = Math.max(1, ...months.map((m) => m.monto))

    // Top clientes por monto aceptado
    const byClient = {}
    aceptados.forEach((b) => {
      const name = b.clients?.name || 'Sin cliente'
      byClient[name] = (byClient[name] || 0) + Number(b.total || 0)
    })
    const topClients = Object.entries(byClient)
      .map(([name, monto]) => ({ name, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5)

    return { total, aceptados: aceptados.length, montoAceptado, montoTotal, tasa, months, maxMonth, topClients }
  }, [budgets])

  const exportCSV = () => {
    const headers = ['Numero', 'Fecha', 'Cliente', 'Estado', 'Moneda', 'Subtotal', 'Descuento', 'Impuesto', 'Total']
    const rows = budgets.map((b) => [
      formatNumero(b.numero, b.issue_date, profile?.number_prefix),
      b.issue_date || '',
      (b.clients?.name || '').replace(/"/g, '""'),
      STATUS[b.status]?.label || b.status,
      b.currency,
      b.subtotal ?? 0,
      b.discount_amount ?? 0,
      b.tax_amount ?? 0,
      b.total ?? 0
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c)}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cati-presupuestos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Reportes</h1>
          <p className="mt-1 text-sm text-ink-soft">Cómo vienen tus presupuestos y tu facturación estimada.</p>
        </div>
        <button onClick={exportCSV} className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink-faint">
          ↓ Exportar CSV
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Presupuestos" value={stats.total} tone="navy" />
        <StatCard label="Aceptados" value={stats.aceptados} tone="teal" hint={formatMoney(stats.montoAceptado, profile?.currency)} />
        <StatCard label="Tasa de aceptación" value={`${stats.tasa}%`} tone="blue" />
        <StatCard label="Monto total emitido" value={formatMoney(stats.montoTotal, profile?.currency)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Facturación aceptada (últimos 6 meses)">
          {stats.months.every((m) => m.monto === 0) ? (
            <p className="py-8 text-center text-sm text-ink-soft">Todavía no hay presupuestos aceptados.</p>
          ) : (
            <div className="space-y-3">
              {stats.months.map((m) => (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs uppercase text-ink-faint">{m.label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-ink/[0.04]">
                    <div
                      className="h-full rounded-md bg-gradient-to-r from-brand-600 to-teal-500"
                      style={{ width: `${Math.max(2, (m.monto / stats.maxMonth) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-xs text-ink-soft">
                    {formatMoney(m.monto, profile?.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top clientes (por monto aceptado)">
          {stats.topClients.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">Sin datos todavía.</p>
          ) : (
            <ul className="divide-y divide-line">
              {stats.topClients.map((c) => (
                <li key={c.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="truncate text-ink">{c.name}</span>
                  <span className="font-mono font-medium text-ink">{formatMoney(c.monto, profile?.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
