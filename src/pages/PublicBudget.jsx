import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform
} from 'motion/react'
import { supabase } from '../lib/supabaseClient'
import Spinner from '../components/Spinner'
import {
  formatMoney,
  formatDate,
  formatNumero,
  contrastText,
  readableAccent,
  isPaleColor,
  needsOutline,
  withAlpha
} from '../lib/utils'
import { lineAmount } from '../components/ItemsTable'

// Entrada en cascada: cada bloque del documento aparece apenas después del anterior.
const reveal = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } }
}

export default function PublicBudget() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: res, error } = await supabase.rpc('get_public_budget', { p_token: token })
      if (!active) return
      if (error || !res) setNotFound(true)
      else setData(res)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [token])

  const respond = async (action) => {
    if (responding) return
    setResponding(true)
    setError('')
    const { data: res, error: rpcError } = await supabase.rpc('set_budget_response', {
      p_token: token,
      p_action: action
    })
    if (res?.status) {
      // Sirve tanto para la respuesta nueva como para `ya_respondido`: en los
      // dos casos el estado que manda es el que devuelve la base. Antes, si el
      // presupuesto ya estaba respondido, el clic no hacía nada visible.
      setData((d) => ({ ...d, budget: { ...d.budget, status: res.status } }))
    } else {
      setError(
        rpcError
          ? 'No pudimos registrar tu respuesta. Probá de nuevo en un momento.'
          : 'Este enlace ya no está disponible. Pedile uno nuevo a quien te lo envió.'
      )
    }
    setResponding(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
        <img src="/numera-icon.svg" alt="Numera" className="mb-4 h-12 w-12" />
        <h1 className="font-display text-xl font-medium text-ink">Presupuesto no encontrado</h1>
        <p className="mt-1 text-sm text-ink-soft">El enlace puede haber cambiado o ya no está disponible.</p>
      </div>
    )
  }

  const { budget, items, business } = data
  // El color de marca lo elige el usuario en Perfil sin restricciones, así que
  // puede ser un amarillo o un pastel. Derivamos una variante oscurecida para
  // usarlo como texto y el color de texto del botón, para que «Aceptar
  // presupuesto» nunca termine en blanco sobre un fondo claro.
  const accent = business?.brand_color || '#2F6BFF'
  const accentInk = readableAccent(accent)
  // Si la marca se funde con el papel (blancos, cremas) no hay color con el que
  // pintar el botón: cae en tinta, que se lee siempre y sigue pareciendo el
  // botón principal. Un gris derivado del blanco quedaba apagado.
  const actionBg = isPaleColor(accent) ? '#14181C' : accent
  const onAction = contrastText(actionBg)
  const outlineAction = needsOutline(actionBg)
  // Sombra teñida con el propio color del botón: lo levanta del papel sin
  // ensuciarlo con un gris genérico.
  const actionShadow = `0 10px 22px -8px ${withAlpha(actionBg, 0.55)}, 0 3px 8px -3px rgba(20, 24, 28, 0.22)`
  const currency = budget.currency
  const balance = (Number(budget.total) || 0) - (Number(budget.deposit) || 0)
  const decided = budget.status === 'aceptado' || budget.status === 'rechazado'

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-paper py-6 sm:py-10">
        <motion.div className="mx-auto max-w-3xl px-4" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={reveal} className="overflow-hidden rounded-xl2 border border-line bg-surface shadow-soft">
          <motion.div
            className="h-1.5 origin-left"
            style={{ background: accent }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
          <motion.div className="p-4 sm:p-10" variants={stagger}>
            {/* Encabezado */}
            {/* Logo a la derecha, en la misma fila que el título: en celular
                así no se come una fila entera. */}
            <motion.header variants={reveal} className="flex items-start justify-between gap-4 sm:gap-6">
              <div className="min-w-0">
                <p className="font-display text-2xl font-medium leading-none sm:text-3xl" style={{ color: accentInk }}>
                  Presupuesto
                </p>
                <p className="mt-1.5 font-mono text-sm tabular-nums tracking-tight text-ink-soft">
                  {formatNumero(budget.numero, budget.issue_date)}
                </p>
                <p className="mt-4 break-words text-base font-semibold tracking-tight text-ink">
                  {business?.business_name || 'Presupuesto'}
                </p>
                <div className="mt-0.5 space-y-px text-xs leading-relaxed text-ink-soft">
                  {business?.tax_id && <p className="break-words tabular-nums">{business.tax_id}</p>}
                  {business?.email && <p className="break-all">{business.email}</p>}
                  {business?.phone && <p className="tabular-nums">{business.phone}</p>}
                </div>
              </div>
              <div className="shrink-0">
                {business?.logo_url ? (
                  <img
                    src={business.logo_url}
                    alt=""
                    className="h-[83px] w-auto max-w-[143px] object-contain object-right sm:h-[125px] sm:max-w-[260px]"
                  />
                ) : (
                  <img src="/numera-icon.svg" alt="" className="h-[73px] w-[73px] sm:h-[104px] sm:w-[104px]" />
                )}
              </div>
            </motion.header>

            {/* Meta: franja de papel con las fechas y el sello de estado */}
            <motion.div
              variants={reveal}
              className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border border-line bg-paper px-4 py-3 text-sm"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Emisión</p>
                <p className="mt-0.5 tabular-nums text-ink">{formatDate(budget.issue_date)}</p>
              </div>
              {budget.due_date && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Válido hasta</p>
                  <p className="mt-0.5 tabular-nums text-ink">{formatDate(budget.due_date)}</p>
                </div>
              )}
              {decided && (
                <div className="ml-auto">
                  <StatusStamp status={budget.status} />
                </div>
              )}
            </motion.div>

            {/* Ítems */}
            <motion.div variants={reveal} className="mt-8 overflow-hidden rounded-lg border border-line">
              <div className="hidden grid-cols-[1fr_60px_minmax(90px,110px)_minmax(90px,110px)] gap-3 border-b border-line bg-paper px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint sm:grid">
                <span>Descripción</span>
                <span className="text-right">Cant.</span>
                <span className="text-right">Precio</span>
                <span className="text-right">Importe</span>
              </div>
              {items.map((it, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.04, type: 'spring', stiffness: 260, damping: 28 }}
                  className="border-b border-line px-4 py-3.5 text-sm transition-colors last:border-0 hover:bg-paper/60 sm:grid sm:grid-cols-[1fr_60px_minmax(90px,110px)_minmax(90px,110px)] sm:items-start sm:gap-3 sm:py-2.5"
                >
                  <span className="block min-w-0 break-words leading-relaxed text-ink">
                    {it.description}
                    {Number(it.discount) > 0 && (
                      <span className="ml-1.5 rounded bg-brass-400/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-brass-600">
                        -{it.discount}%
                      </span>
                    )}
                  </span>

                  {/* Móvil: cantidad × precio en una línea, importe a la derecha */}
                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-dashed border-line pt-2 sm:hidden">
                    <span className="font-mono text-xs tabular-nums text-ink-faint">
                      {it.quantity} × {formatMoney(it.unit_price, currency)}
                    </span>
                    <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-ink">
                      {formatMoney(lineAmount(it), currency)}
                    </span>
                  </div>

                  {/* Escritorio: columnas */}
                  <span className="hidden text-right font-mono tabular-nums text-ink-soft sm:block">{it.quantity}</span>
                  <span className="hidden whitespace-nowrap text-right font-mono tabular-nums text-ink-soft sm:block">
                    {formatMoney(it.unit_price, currency)}
                  </span>
                  <span className="hidden whitespace-nowrap text-right font-mono font-semibold tabular-nums text-ink sm:block">
                    {formatMoney(lineAmount(it), currency)}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Totales */}
            <motion.div variants={reveal} className="mt-5 flex justify-end">
              <div className="w-full font-mono text-sm sm:max-w-sm">
                <div className="space-y-2">
                  <Row label="Subtotal" value={formatMoney(budget.subtotal, currency)} />
                  {Number(budget.discount_amount) > 0 && <Row label="Descuento" value={`-${formatMoney(budget.discount_amount, currency)}`} />}
                  {Number(budget.tax_amount) > 0 && <Row label={`Impuesto (${budget.tax_rate}%)`} value={formatMoney(budget.tax_amount, currency)} />}
                </div>

                {/* El total, en su propio panel: es lo que el cliente busca */}
                <div
                  className="mt-3 flex items-baseline justify-between gap-3 rounded-lg px-4 py-3"
                  style={{ background: `${accent}0F` }}
                >
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    Total
                  </span>
                  <span className="whitespace-nowrap text-xl font-semibold tabular-nums" style={{ color: accentInk }}>
                    <CountingMoney value={budget.total} currency={currency} />
                  </span>
                </div>

                {Number(budget.deposit) > 0 && (
                  <div className="mt-2 space-y-2">
                    <Row label="Anticipo / seña" value={`-${formatMoney(budget.deposit, currency)}`} />
                    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                      <span className="font-sans font-semibold text-ink">Saldo</span>
                      <span className="whitespace-nowrap font-semibold tabular-nums text-ink">
                        {formatMoney(balance, currency)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Pago / notas */}
            {(budget.payment_terms || budget.payment_methods || business?.bank_alias || budget.delivery_time || budget.notes || budget.terms) && (
              <motion.div variants={reveal} className="mt-8 grid gap-x-8 gap-y-5 border-t border-line pt-6 text-sm sm:grid-cols-2">
                <Block title="Condiciones de pago" text={budget.payment_terms} />
                <Block title="Formas de pago" text={budget.payment_methods} />
                <Block title="Datos bancarios / alias" text={business?.bank_alias} />
                <Block title="Plazo de entrega" text={budget.delivery_time} />
                <Block title="Notas" text={budget.notes} />
                <Block title="Condiciones" text={budget.terms} />
              </motion.div>
            )}

            {/* Términos y condiciones del negocio */}
            {business?.legal_terms?.trim() && (
              <motion.div variants={reveal} className="mt-8 border-t border-line pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  Términos y condiciones
                </p>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-faint">
                  {business.legal_terms.trim()}
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* Acciones del cliente. Mientras está pendiente la tarjeta queda pegada
            al borde inferior de la pantalla: el botón de aceptar se ve desde el
            primer momento, sin tener que scrollear el documento entero. */}
        <motion.div
          variants={reveal}
          layout
          className={`mt-4 rounded-xl2 border border-line bg-surface p-5 text-center sm:p-6 ${
            decided
              ? 'shadow-soft'
              : 'sticky bottom-3 z-20 shadow-[0_-2px_10px_-6px_rgba(20,24,28,0.12),0_16px_40px_-16px_rgba(20,24,28,0.35)]'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {decided ? (
              <motion.div
                key="decidido"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center justify-center gap-2"
              >
                {budget.status === 'aceptado' && <CheckMark color="#189B84" />}
                <p
                  className="text-sm font-medium"
                  style={{ color: budget.status === 'aceptado' ? '#189B84' : '#B4483A' }}
                >
                  {budget.status === 'aceptado'
                    ? 'Aceptaste este presupuesto. ¡Gracias!'
                    : 'Rechazaste este presupuesto.'}
                </p>
              </motion.div>
            ) : (
              <motion.div key="pendiente" exit={{ opacity: 0, y: -8 }}>
                <p className="mb-4 font-display text-lg text-ink">¿Avanzamos con este presupuesto?</p>
                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <motion.button
                    onClick={() => respond('aceptado')}
                    disabled={responding}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="rounded-xl border px-7 py-4 text-base font-semibold tracking-tight disabled:opacity-60 sm:py-3.5"
                    style={{
                      background: actionBg,
                      color: onAction,
                      // Un color claro (un amarillo, por ejemplo) necesita borde
                      // para recortarse del papel.
                      borderColor: outlineAction ? 'rgba(20,24,28,0.18)' : 'transparent',
                      boxShadow: actionShadow
                    }}
                  >
                    {responding ? 'Enviando…' : 'Aceptar presupuesto'}
                  </motion.button>
                  <motion.button
                    onClick={() => respond('rechazado')}
                    disabled={responding}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="rounded-xl px-7 py-2.5 text-sm font-medium text-ink-faint underline-offset-4 transition-colors hover:text-rust-500 hover:underline disabled:opacity-60"
                  >
                    Rechazar
                  </motion.button>
                </div>
                {error && <p className="mt-3 text-sm text-rust-500">{error}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p
          variants={reveal}
          className="mt-5 text-center text-[11px] uppercase tracking-[0.16em] text-ink-faint"
        >
          {business?.hide_branding ? business?.business_name : 'Numera de sTuDiO B2B'}
        </motion.p>
        </motion.div>
      </div>
    </MotionConfig>
  )
}

// El total cuenta desde cero hasta su valor: llama la atención sin ser estridente.
function CountingMoney({ value, currency }) {
  const target = Number(value) || 0
  const reduced = useReducedMotion()
  const raw = useMotionValue(reduced ? target : 0)
  const text = useTransform(raw, (v) => formatMoney(v, currency))

  useEffect(() => {
    if (reduced) {
      raw.set(target)
      return
    }
    const controls = animate(raw, target, { duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [target, reduced, raw])

  return <motion.span>{text}</motion.span>
}

function CheckMark({ color }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="2.4">
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      <motion.path
        d="M7.5 12.5l3 3 6-6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.35, ease: 'easeOut' }}
      />
    </svg>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-ink-soft">
      <span className="font-sans text-[13px]">{label}</span>
      <span className="whitespace-nowrap tabular-nums text-ink">{value}</span>
    </div>
  )
}

function Block({ title, text }) {
  if (!text) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{title}</p>
      <p className="mt-1.5 whitespace-pre-line break-words leading-relaxed text-ink-soft">{text}</p>
    </div>
  )
}

// Sello ligeramente rotado, en la línea del resto del sistema (.stamp)
function StatusStamp({ status }) {
  const aceptado = status === 'aceptado'
  const color = aceptado ? '#189B84' : '#B4483A'
  return (
    <motion.span
      initial={{ opacity: 0, scale: 1.3, rotate: -12 }}
      animate={{ opacity: 1, scale: 1, rotate: -3 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.4 }}
      className="inline-block rounded border-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
      style={{ color, borderColor: color, background: `${color}0F` }}
    >
      {aceptado ? 'Aceptado' : 'Rechazado'}
    </motion.span>
  )
}
