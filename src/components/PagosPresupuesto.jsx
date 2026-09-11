import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Paperclip, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { formatDate, formatMoney, montoDePorcentaje, resumenDePagos, MAX_PAGOS } from '../lib/utils'

// El mismo bucket y el mismo techo que el PDF propio (migración 25).
const MAX_BYTES = 15 * 1024 * 1024
const TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

/**
 * Las etapas de pago de un presupuesto y cuál de ellas ya entró.
 *
 * El campo `deposit` de siempre alcanza para «mitad y mitad». Para
 * «seña 10%, anticipo 40%, saldo 50%» hace falta saber cuál de las tres
 * está cobrada, y eso es lo que se anota acá (columna pagos, migración
 * 32).
 *
 * Cada etapa guarda su monto, no solo el porcentaje: si mañana se
 * corrige el total del presupuesto, lo que el cliente ya pagó no cambia
 * de golpe. El porcentaje queda al lado, para mostrarlo y para proponer
 * el monto al crear la etapa.
 */
export default function PagosPresupuesto({ userId, total, currency, value, onChange, guardando }) {
  const { t } = useTranslation()
  const { etapas, cobrado, falta, sinAsignar } = resumenDePagos(value, total)

  const [agregando, setAgregando] = useState(false)
  const [cobrandoIdx, setCobrandoIdx] = useState(-1)
  const [error, setError] = useState('')

  const guardar = (nuevas) => {
    setError('')
    onChange(nuevas)
  }

  const agregarEtapa = (etapa) => {
    guardar([...etapas, etapa].slice(0, MAX_PAGOS))
    setAgregando(false)
  }

  const quitarEtapa = (i) => {
    if (!window.confirm(t('pagos.confirmarQuitar', { nombre: etapas[i]?.label || '' }))) return
    guardar(etapas.filter((_, j) => j !== i))
  }

  const marcarCobrado = (i, datos) => {
    guardar(etapas.map((p, j) => (j === i ? { ...p, ...datos } : p)))
    setCobrandoIdx(-1)
  }

  const desmarcar = (i) => {
    guardar(etapas.map((p, j) => (j === i ? { ...p, paid_at: null } : p)))
  }

  return (
    <div className="rounded-xl2 border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {t('pagos.titulo')}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">{t('pagos.desc')}</p>
        </div>
        {etapas.length < MAX_PAGOS && !agregando && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink"
          >
            {t('pagos.agregar')}
          </button>
        )}
      </div>

      {etapas.length === 0 && !agregando && (
        <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-5 text-center">
          <p className="text-sm text-ink-soft">{t('pagos.vacio')}</p>
          <p className="mt-1 text-xs text-ink-faint">{t('pagos.vacioAyuda')}</p>
        </div>
      )}

      {etapas.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {etapas.map((p, i) => (
            <li key={i} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      p.paid_at
                        ? 'border-teal-500 bg-teal-500 text-white'
                        : 'border-line text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {p.label}
                      {p.percent != null && p.percent > 0 && (
                        <span className="ml-1.5 font-normal text-ink-faint">· {p.percent}%</span>
                      )}
                    </p>
                    {p.paid_at ? (
                      <p className="mt-0.5 text-xs text-teal-600">
                        {t('pagos.cobradoEl', { fecha: formatDate(p.paid_at) })}
                        {p.method ? ` · ${p.method}` : ''}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-ink-faint">{t('pagos.pendiente')}</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-ink">
                    {formatMoney(p.amount, currency)}
                  </span>
                  <div className="flex items-center gap-2">
                    {p.comprobante && (
                      <a
                        href={p.comprobante}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                      >
                        <Paperclip size={12} aria-hidden="true" />
                        {t('pagos.verComprobante')}
                      </a>
                    )}
                    {p.paid_at ? (
                      <button
                        type="button"
                        onClick={() => desmarcar(i)}
                        className="text-xs text-ink-faint hover:text-ink"
                      >
                        {t('pagos.marcarNoCobrado')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCobrandoIdx(cobrandoIdx === i ? -1 : i)}
                        className="rounded-md border border-teal-500/50 px-2 py-1 text-xs font-medium text-teal-600 transition hover:bg-teal-500/[0.08]"
                      >
                        {t('pagos.cobreEsto')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => quitarEtapa(i)}
                      aria-label={t('pagos.quitarEtapa')}
                      title={t('pagos.quitarEtapa')}
                      className="rounded p-1 text-ink-faint transition hover:bg-rust-500/10 hover:text-rust-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {cobrandoIdx === i && (
                <FormularioCobro
                  userId={userId}
                  etapa={p}
                  onCancel={() => setCobrandoIdx(-1)}
                  onError={setError}
                  onSave={(datos) => marcarCobrado(i, datos)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {agregando && (
        <FormularioEtapa
          total={total}
          currency={currency}
          onCancel={() => setAgregando(false)}
          onSave={agregarEtapa}
        />
      )}

      {etapas.length > 0 && (
        <div className="mt-4 space-y-1.5 font-mono text-sm">
          <div className="flex items-center justify-between">
            <span className="font-sans text-ink-soft">{t('pagos.cobrado')}</span>
            <span className="font-semibold tabular-nums text-teal-600">{formatMoney(cobrado, currency)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-1.5">
            <span className="font-sans font-semibold text-ink">{t('pagos.falta')}</span>
            <span className="font-semibold tabular-nums text-ink">{formatMoney(falta, currency)}</span>
          </div>
        </div>
      )}

      {/* El error más fácil de cometer cargando etapas es que no sumen el
          total. Mejor decirlo que dejar un número silenciosamente mal. */}
      {etapas.length > 0 && Math.abs(sinAsignar) >= 0.01 && (
        <p className="mt-3 rounded-md border border-brass-500/40 bg-brass-500/[0.08] px-3 py-2 text-xs leading-relaxed text-ink-soft">
          {t('pagos.sinAsignarAviso', {
            suma: formatMoney(cobrado + (falta - sinAsignar), currency),
            total: formatMoney(total, currency),
            resto: formatMoney(sinAsignar, currency)
          })}
        </p>
      )}

      {guardando && <p className="mt-3 text-xs text-ink-faint">{t('comun.guardando')}</p>}
      {error && <p className="mt-3 text-xs text-rust-500">{error}</p>}
    </div>
  )
}

/** Alta de una etapa. El monto se propone desde el porcentaje, y se puede pisar. */
function FormularioEtapa({ total, currency, onCancel, onSave }) {
  const { t } = useTranslation()
  const [label, setLabel] = useState('')
  const [percent, setPercent] = useState('')
  const [amount, setAmount] = useState('')
  // Mientras no toque el monto a mano, sigue al porcentaje.
  const [montoManual, setMontoManual] = useState(false)

  const montoMostrado = montoManual ? amount : percent === '' ? '' : montoDePorcentaje(total, percent)

  const submit = (e) => {
    e.preventDefault()
    if (!label.trim()) return
    onSave({
      label: label.trim(),
      percent: percent === '' ? null : Number(percent) || 0,
      amount: Number(montoMostrado) || 0,
      paid_at: null,
      method: '',
      comprobante: ''
    })
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-lg border border-line bg-paper/50 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_80px_130px]">
        <Campo label={t('pagos.nombreEtapa')}>
          <input
            autoFocus
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('pagos.ejemploSena')}
            className={entradaCls}
          />
        </Campo>
        <Campo label={t('pagos.porcentaje')}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value)
              setMontoManual(false)
            }}
            className={`${entradaCls} text-right font-mono`}
          />
        </Campo>
        <Campo label={t('pagos.monto')}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={montoMostrado}
            onChange={(e) => {
              setAmount(e.target.value)
              setMontoManual(true)
            }}
            className={`${entradaCls} text-right font-mono`}
          />
        </Campo>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="submit"
          disabled={!label.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          <Plus size={13} aria-hidden="true" />
          {t('pagos.agregarEtapa')}
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-soft hover:text-ink">
          {t('comun.cancelar')}
        </button>
        <span className="ml-auto font-mono text-xs text-ink-faint">
          {formatMoney(Number(montoMostrado) || 0, currency)}
        </span>
      </div>
    </form>
  )
}

/** Marcar una etapa como cobrada: fecha, medio y el comprobante que mandó el cliente. */
function FormularioCobro({ userId, etapa, onCancel, onSave, onError }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  const hoy = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(etapa.paid_at || hoy)
  const [metodo, setMetodo] = useState(etapa.method || '')
  const [comprobante, setComprobante] = useState(etapa.comprobante || '')
  const [subiendo, setSubiendo] = useState(false)

  const elegirArchivo = async (e) => {
    const file = (e.target.files || [])[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return

    onError('')
    if (!TIPOS.includes(file.type)) {
      onError(t('pagos.formatoComprobante'))
      return
    }
    if (file.size > MAX_BYTES) {
      onError(t('pagos.pesado', { nombre: file.name }))
      return
    }

    setSubiendo(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${userId}/presupuestos/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('adjuntos')
        .upload(path, file, { cacheControl: '3600', contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('adjuntos').getPublicUrl(path)
      setComprobante(data.publicUrl)
    } catch (err) {
      onError(err?.message || t('pagos.errorSubir'))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-teal-500/30 bg-teal-500/[0.05] p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo label={t('pagos.fecha')}>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={entradaCls} />
        </Campo>
        <Campo label={t('pagos.metodo')}>
          <input
            type="text"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            placeholder={t('pagos.metodoEjemplo')}
            className={entradaCls}
          />
        </Campo>
      </div>

      <div className="mt-2.5">
        <span className="mb-1.5 block text-xs font-medium text-ink">{t('pagos.comprobante')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-ink-faint disabled:opacity-60"
          >
            <Paperclip size={13} aria-hidden="true" />
            {subiendo
              ? t('pagos.subiendo')
              : comprobante
                ? t('pagos.cambiarComprobante')
                : t('pagos.adjuntar')}
          </button>
          {comprobante && (
            <>
              <a
                href={comprobante}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {t('pagos.verComprobante')}
              </a>
              <button
                type="button"
                onClick={() => setComprobante('')}
                className="text-xs text-ink-faint hover:text-rust-500"
              >
                {t('pagos.quitarComprobante')}
              </button>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={elegirArchivo}
          className="hidden"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={subiendo}
          onClick={() => onSave({ paid_at: fecha || hoy, method: metodo, comprobante })}
          className="rounded-md bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
        >
          {t('pagos.confirmarPago')}
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-soft hover:text-ink">
          {t('comun.cancelar')}
        </button>
      </div>
    </div>
  )
}

const entradaCls =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none'

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}
