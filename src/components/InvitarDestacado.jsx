import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { buildReferralUrl, MAX_INVITADOS } from '../lib/referral'
import { trazo } from '../lib/brandPaths'

/**
 * El premio por invitar, en el panel y no escondido en el menú.
 *
 * La página /invitar explica todo; acá va lo único que mueve a alguien a
 * compartir: cuánto gana, cuánto le falta y un botón que abre WhatsApp
 * con el mensaje ya escrito. Un clic, no cinco.
 *
 * Desaparece sola cuando el premio ya está cobrado.
 */
export default function InvitarDestacado() {
  const { user, profile } = useAuth()
  const [confirmados, setConfirmados] = useState(null)

  useEffect(() => {
    if (!user) return
    let activo = true
    supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmado')
      .then(({ count, error }) => {
        // Si falta la migración 10, la tarjeta no aparece y listo.
        if (activo) setConfirmados(error ? null : count || 0)
      })
    return () => {
      activo = false
    }
  }, [user])

  const code = profile?.referral_code || ''
  const url = buildReferralUrl(code)

  if (!code || confirmados === null || profile?.referral_bonus_at) return null

  const faltan = Math.max(0, MAX_INVITADOS - confirmados)
  const mensaje = `Hola! Estoy usando Numera para hacer mis presupuestos y me re sirve. Si querés probarla, entrá por acá: ${url}`
  const waLink = `https://wa.me/?text=${encodeURIComponent(mensaje)}`

  return (
    <section className="mt-10 overflow-hidden rounded-xl2 border border-brass-500/30 bg-gradient-to-br from-brass-400/[0.16] to-brand-500/[0.06] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brass-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brass-600">
            🎁 3 meses gratis
          </p>
          <h2 className="mt-2.5 font-display text-xl font-medium text-ink">
            Recomendá Numera y ganá 3 meses de premium
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {confirmados === 0
              ? `Con ${MAX_INVITADOS} personas que se registren por tu link, son tuyos.`
              : faltan > 0
                ? `Ya van ${confirmados} de ${MAX_INVITADOS}. Te ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`} para cobrarlos.`
                : 'Completaste los invitados: el premio se acredita solo.'}
          </p>

          <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: MAX_INVITADOS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-10 rounded-full ${i < confirmados ? 'bg-brass-500' : 'bg-ink/10'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-95"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
              <path d={trazo('whatsapp')} />
            </svg>
            Compartir por WhatsApp
          </a>
          <Link
            to="/invitar"
            className="text-center text-xs font-medium text-ink-soft transition hover:text-ink"
          >
            Ver mi link, el QR y a quién invité
          </Link>
        </div>
      </div>
    </section>
  )
}
