import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import MiFirma from '../components/MiFirma'
import { formatDate, formatNumero } from '../lib/utils'
import {
  NDA_STATUS,
  JURISDICCION_DEFAULT,
  VIGENCIA_INDEFINIDA,
  textoAcuerdo,
  huellaDe
} from '../lib/nda'

const COLOR_MAP = {
  ink: 'text-ink border-ink/30 bg-ink/[0.03]',
  brass: 'text-brass-600 border-brass-500/40 bg-brass-500/[0.08]',
  teal: 'text-teal-600 border-teal-500/50 bg-teal-500/[0.10]'
}

const VACIO = {
  parte_nombre: '',
  parte_doc: '',
  parte_email: '',
  parte_telefono: '',
  parte_domicilio: '',
  proyecto: '',
  jurisdiccion: JURISDICCION_DEFAULT
}

/**
 * Acuerdos de confidencialidad. Solo para el dueño de la app.
 *
 * El candado real está en la base (migración 27): las políticas RLS de
 * la tabla `ndas` exigen public.is_admin() para leer y para escribir.
 * Esta pantalla solo evita mostrarle a un usuario común algo que igual
 * le vendría vacío.
 */
export default function Confidencialidad() {
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [ndas, setNdas] = useState([])
  const [loading, setLoading] = useState(true)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false)
      return
    }
    let activo = true
    supabase
      .from('ndas')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!activo) return
        setNdas(data || [])
        setLoading(false)
      })
    return () => {
      activo = false
    }
  }, [user, isAdmin])

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl font-medium text-ink">No disponible</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Esta sección no está habilitada en tu cuenta.
        </p>
        <Link to="/panel" className="mt-6 inline-block text-sm text-brand-700 underline">
          Volver al panel
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Confidencialidad</h1>
          <p className="mt-1 text-sm text-ink-soft">
            El papel que el cliente pide firmar antes de contarte la idea.
          </p>
        </div>
        <button
          onClick={() => setAbierto(true)}
          className="btn-primary inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
        >
          + Nuevo acuerdo
        </button>
      </header>

      <MiFirma />

      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {loading ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : ndas.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-ink-soft">Todavía no armaste ningún acuerdo.</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-ink-faint">
              Armás uno, le mandás el link por WhatsApp, firma con el dedo desde el celular y
              recién ahí te cuenta el proyecto.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {ndas.map((n) => {
              const meta = NDA_STATUS[n.status] || NDA_STATUS.pendiente
              return (
                <li key={n.id}>
                  <Link
                    to={`/confidencialidad/${n.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-brand-500/[0.04]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {n.parte_nombre || 'Sin nombre'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">
                        {formatNumero(n.numero, n.created_at?.slice(0, 10), 'CONF')} ·{' '}
                        {formatDate(n.created_at?.slice(0, 10))}
                        {n.proyecto ? ` · ${n.proyecto}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {n.status === 'pendiente' && (
                        <span className="hidden text-xs text-ink-faint sm:inline">
                          {n.firmado_emisor_at ? 'Falta el cliente' : 'Falta tu firma'}
                        </span>
                      )}
                      <span
                        className={`stamp inline-flex items-center rounded-md border-2 px-2.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider ${
                          COLOR_MAP[meta.color]
                        }`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {abierto && (
        <ModalNuevo
          user={user}
          profile={profile}
          onClose={() => setAbierto(false)}
          onCreado={(id) => navigate(`/confidencialidad/${id}`)}
        />
      )}
    </div>
  )
}

function ModalNuevo({ user, profile, onClose, onCreado }) {
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    setError('')

    try {
      // El texto se arma acá y se guarda entero en la fila. A partir de
      // este momento el acuerdo es ese texto, no la plantilla.
      //
      // La otra parte va SIN datos: queda el hueco que completa el
      // cliente al firmar. Aunque acá arriba se haya escrito un nombre
      // de referencia, no entra en el acuerdo: el que vale es el que
      // escribe quien firma.
      const cuerpo = textoAcuerdo({
        emisor: {
          nombre: profile?.business_name || 'Tu negocio',
          doc: profile?.tax_id,
          domicilio: profile?.address
        },
        parte: {},
        proyecto: form.proyecto.trim(),
        vigenciaAnios: VIGENCIA_INDEFINIDA,
        jurisdiccion: form.jurisdiccion.trim() || JURISDICCION_DEFAULT
      })
      const huella = await huellaDe(cuerpo)

      const { count } = await supabase
        .from('ndas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      // Si ya tenés la firma guardada, el acuerdo nace firmado por vos:
      // se arma y se manda de una. Es el caso normal; dibujarla a mano en
      // la ficha queda para cuando todavía no hay ninguna guardada.
      const yaFirmado = profile?.firma_png
        ? {
            firma_emisor: profile.firma_png,
            firma_emisor_nombre: profile.business_name || '',
            firma_emisor_doc: profile.tax_id || '',
            firmado_emisor_at: new Date().toISOString()
          }
        : {}

      const { data, error: insErr } = await supabase
        .from('ndas')
        .insert({
          ...yaFirmado,
          user_id: user.id,
          numero: (count || 0) + 1,
          parte_nombre: form.parte_nombre.trim(),
          parte_doc: form.parte_doc.trim(),
          parte_email: form.parte_email.trim(),
          parte_telefono: form.parte_telefono.trim(),
          parte_domicilio: form.parte_domicilio.trim(),
          proyecto: form.proyecto.trim(),
          vigencia_anios: VIGENCIA_INDEFINIDA,
          jurisdiccion: form.jurisdiccion.trim() || JURISDICCION_DEFAULT,
          cuerpo,
          huella
        })
        .select()
        .single()

      if (insErr) throw insErr
      onCreado(data.id)
    } catch (err) {
      setError(
        err?.message?.includes('row-level security')
          ? 'Tu cuenta no tiene habilitada esta sección.'
          : 'No pudimos crear el acuerdo. Probá de nuevo.'
      )
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={guardar}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl2 border border-line bg-surface shadow-soft sm:rounded-xl2"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
          <p className="font-display text-base font-medium text-ink">Nuevo acuerdo</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Los datos del cliente NO se piden acá. El que desconfía no
              quiere darlos antes de leer lo que va a firmar, y encima así
              los escribe él mismo y no hay nada que corregirle después. */}
          <div className="rounded-lg border border-line bg-paper p-3.5">
            <p className="text-sm leading-relaxed text-ink">
              Vos completás lo tuyo y nada más. Los datos del cliente los escribe él mismo cuando
              abre el link para firmar, y te llegan acá.
            </p>
          </div>

          <div>
            <Campo
              label="Nombre del cliente"
              value={form.parte_nombre}
              onChange={set('parte_nombre')}
              placeholder="Solo para reconocerlo en tu lista"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              Opcional, y es solo para vos: no sale en el acuerdo. El nombre que vale es el que
              escriba él al firmar.
            </p>
          </div>

          <Campo
            label="Teléfono"
            value={form.parte_telefono}
            onChange={set('parte_telefono')}
            placeholder="11 5555-4444"
          />

          <div>
            <Campo
              label="¿Sobre qué van a hablar?"
              value={form.proyecto}
              onChange={set('proyecto')}
              placeholder="Ej: el desarrollo de una aplicación móvil a medida"
            />
            {/* Este texto viaja en el link y lo lee cualquiera que lo
                reciba. Vale la pena decirlo antes de que escriba la idea
                entera acá adentro. */}
            <p className="mt-1.5 text-xs text-ink-faint">
              En una línea y sin detalles: esto se lee en el link, antes de firmar. La idea te la
              cuenta después.
            </p>
          </div>

          <Campo label="Tribunales de" value={form.jurisdiccion} onChange={set('jurisdiccion')} />

          {error && (
            <p className="rounded-md border border-rust-500/40 bg-rust-500/[0.08] px-3 py-2 text-xs text-rust-500">
              {error}
            </p>
          )}

          <p className="text-xs leading-relaxed text-ink-faint">
            Se usa un modelo de acuerdo mutuo: los dos se obligan a no divulgar lo que les cuenta
            el otro. Podés leerlo completo en la pantalla siguiente antes de mandarlo.
          </p>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-ink/5"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="btn-primary flex-1 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {guardando ? 'Creando…' : 'Crear acuerdo'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Campo({ label, required, ...props }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        {label}
        {required && <span className="text-rust-500"> *</span>}
      </label>
      <input
        {...props}
        className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
    </div>
  )
}
