import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { buildReferralUrl, MAX_INVITADOS } from '../lib/referral'
import { FREE_FOR_ALL, FREE_UNTIL_LABEL } from '../lib/config'
import { formatDate } from '../lib/utils'
import Spinner from '../components/Spinner'

export default function Invitar() {
  const { profile, user, refreshProfile } = useAuth()
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [missingMigration, setMissingMigration] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState('')

  const code = profile?.referral_code || ''
  const url = useMemo(() => buildReferralUrl(code), [code])

  const confirmados = referrals.filter((r) => r.status === 'confirmado')
  const pendientes = referrals.filter((r) => r.status === 'pendiente')
  const logrado = confirmados.length >= MAX_INVITADOS
  const bonusAt = profile?.referral_bonus_at

  useEffect(() => {
    if (!user) return
    let active = true
    supabase
      .from('referrals')
      .select('id, invited_masked, status, created_at, confirmed_at')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        // La tabla no existe todavía = falta correr la migración 10.
        if (error) setMissingMigration(true)
        setReferrals(data || [])
        setLoading(false)
      })
    // El premio lo acredita la base de datos, así que al entrar acá
    // recargamos el perfil para ver el premium recién sumado.
    refreshProfile()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!url) return
    QRCode.toDataURL(url, { width: 260, margin: 1, color: { dark: '#1B3B6F', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [url])

  const copiar = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const mensaje = `Hola! Estoy usando Numera para hacer mis presupuestos y me re sirve. Si querés probarla, entrá por acá: ${url}`
  const waLink = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
  const mailLink = `mailto:?subject=${encodeURIComponent('Te recomiendo Numera')}&body=${encodeURIComponent(mensaje)}`

  const compartirNativo = async () => {
    try {
      await navigator.share({ title: 'Numera', text: mensaje, url })
    } catch {
      // El usuario canceló o el navegador no soporta compartir: no pasa nada.
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-medium text-ink">Invitá y ganá 3 meses</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Pasale tu link a otros que facturen por su cuenta. Cuando se registren{' '}
          <b className="text-ink">{MAX_INVITADOS}</b>, te regalamos{' '}
          <b className="text-ink">3 meses de premium</b>.
        </p>
      </header>

      {missingMigration && (
        <p className="mb-5 rounded-xl2 border border-brass-500/40 bg-brass-500/[0.08] px-4 py-3 text-sm text-ink-soft">
          Falta ejecutar la migración <b>10_invitaciones</b> en Supabase para que las invitaciones
          se registren.
        </p>
      )}

      {/* Premio ya cobrado */}
      {bonusAt && (
        <div className="mb-5 rounded-xl2 border border-teal-500/30 bg-teal-500/[0.07] px-4 py-3 text-sm text-teal-600">
          🎉 ¡Listo! Ya sumaste tus 3 meses de premium el {formatDate(bonusAt.slice(0, 10))}.
        </div>
      )}

      {/* Progreso */}
      <section className="rounded-xl2 border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-medium text-ink">Tu progreso</h2>
          <p className="font-mono text-sm text-ink-soft">
            <span className="text-lg font-semibold text-brand-600">{confirmados.length}</span> de{' '}
            {MAX_INVITADOS}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {Array.from({ length: MAX_INVITADOS }).map((_, i) => {
            const hecho = i < confirmados.length
            return (
              <div
                key={i}
                className={`rounded-xl2 border px-3 py-4 text-center transition ${
                  hecho
                    ? 'border-teal-500/40 bg-teal-500/[0.08]'
                    : 'border-dashed border-line bg-paper/50'
                }`}
              >
                <p className={`text-xl ${hecho ? '' : 'opacity-40'}`}>{hecho ? '✅' : '👤'}</p>
                <p className={`mt-1 text-xs font-medium ${hecho ? 'text-teal-600' : 'text-ink-faint'}`}>
                  {hecho ? confirmados[i].invited_masked || 'Invitado' : `Invitado ${i + 1}`}
                </p>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-xs text-ink-faint">
          {logrado
            ? 'Completaste los 3 invitados. El premio se acredita solo, no tenés que hacer nada.'
            : `Te faltan ${MAX_INVITADOS - confirmados.length} para cobrar los 3 meses.`}
        </p>
      </section>

      {/* Link para compartir */}
      <section className="mt-6 rounded-xl2 border border-line bg-surface p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-lg font-medium text-ink">Tu link para invitar</h2>

        {!code ? (
          <p className="mt-3 text-sm text-ink-soft">
            Todavía no tenés código. Cerrá sesión y volvé a entrar; si sigue igual, avisanos.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              {qr && (
                <img
                  src={qr}
                  alt="QR de tu invitación"
                  className="h-28 w-28 shrink-0 rounded-md border border-line"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-2 font-mono text-[11px] text-ink-soft focus:outline-none"
                  />
                  <button
                    onClick={copiar}
                    className="shrink-0 rounded-md border border-line px-3 py-2 text-xs font-medium text-ink-soft transition hover:border-ink-faint"
                  >
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-teal-500 hover:text-teal-600"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={mailLink}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand-500 hover:text-brand-600"
                  >
                    Email
                  </a>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={compartirNativo}
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-ink-faint hover:text-ink"
                    >
                      Compartir…
                    </button>
                  )}
                </div>

                <p className="mt-3 text-xs text-ink-faint">
                  Tu código es <span className="font-mono font-semibold text-ink-soft">{code}</span>.
                  El QR sirve para mostrarlo en persona.
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Invitados */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-medium text-ink">Tus invitados</h2>
        <div className="mt-3 overflow-hidden rounded-xl2 border border-line bg-surface">
          {referrals.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-ink-soft">Todavía no invitaste a nadie.</p>
              <p className="mt-1 text-xs text-ink-faint">
                Mandá tu link por WhatsApp: es la forma más rápida.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {referrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.invited_masked || 'Invitado'}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      Se anotó el {formatDate(r.created_at.slice(0, 10))}
                    </p>
                  </div>
                  {r.status === 'confirmado' ? (
                    <span className="shrink-0 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-600">
                      Confirmado
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-brass-500/10 px-2.5 py-1 text-xs font-medium text-brass-600">
                      Falta confirmar
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {pendientes.length > 0 && (
          <p className="mt-2 text-xs text-ink-faint">
            «Falta confirmar» significa que se registró pero todavía no hizo clic en el mail de
            confirmación. Recién ahí cuenta para el premio.
          </p>
        )}
      </section>

      {/* Reglas */}
      <section className="mt-6 rounded-xl2 border border-line bg-paper/50 p-5">
        <h2 className="text-sm font-semibold text-ink">Cómo funciona</h2>
        <ul className="mt-2.5 space-y-1.5 text-sm text-ink-soft">
          <li>· Mandá tu link a hasta {MAX_INVITADOS} personas.</li>
          <li>· Tienen que crear la cuenta desde tu link y confirmar su email.</li>
          <li>· Al tercer invitado confirmado se te acreditan 3 meses de premium, automáticamente.</li>
          <li>· Es una sola vez por cuenta y no vale invitarte a vos mismo.</li>
          {FREE_FOR_ALL && (
            <li>
              · Hasta el {FREE_UNTIL_LABEL} la app está gratis para todos, así que los 3 meses te
              quedan guardados y empiezan a correr a partir de esa fecha. No los perdés.
            </li>
          )}
          <li>
            · Si ya tenés premium, los 3 meses se suman al final de lo que tengas. Podés verlo en{' '}
            <Link to="/premium" className="font-medium text-brand-600 hover:underline">
              Premium
            </Link>
            .
          </li>
        </ul>
      </section>
    </div>
  )
}
