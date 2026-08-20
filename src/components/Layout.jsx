import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../hooks/usePlan'
import { classNames } from '../lib/utils'
import Notificaciones from './Notificaciones'
import { PROMO_LABEL, FREE_UNTIL_LABEL, freeDaysLeft } from '../lib/config'

const NAV_ITEMS = [
  { to: '/panel', label: 'Panel', icon: IconGrid },
  { to: '/presupuestos', label: 'Presupuestos', icon: IconDoc },
  { to: '/facturas', label: 'Facturas', icon: IconReceipt },
  { to: '/catalogo', label: 'Catálogo', icon: IconTag },
  { to: '/clientes', label: 'Clientes', icon: IconUsers },
  { to: '/reportes', label: 'Reportes', icon: IconChart },
  { to: '/perfil', label: 'Mi negocio', icon: IconBuilding },
  // El premio va escrito en el menú: si no dice qué se gana, nadie entra.
  { to: '/invitar', label: 'Invitar y ganar', icon: IconGift, badge: '3 meses' },
  { to: '/ayuda', label: 'Ayuda', icon: IconHelp }
]

// Accesos rápidos en la barra inferior de celular (el resto está en el menú).
const MOBILE_ITEMS = [
  { to: '/panel', label: 'Panel', icon: IconGrid },
  { to: '/presupuestos', label: 'Presup.', icon: IconDoc },
  { to: '/catalogo', label: 'Catálogo', icon: IconTag },
  { to: '/clientes', label: 'Clientes', icon: IconUsers }
]

// Solo para el dueño. Se agrega al final del menú si la base de datos
// dice que esta cuenta es admin.
const ADMIN_ITEM = { to: '/admin', label: 'Administración', icon: IconShield }

export default function Layout({ children }) {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  const handleSignOut = async () => {
    await signOut()
    navigate('/ingresar')
  }

  return (
    <div className="min-h-dvh bg-paper">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface px-5 py-6 lg:flex">
        <Brand />
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-sans text-sm font-semibold text-ink">
              {profile?.business_name || 'Tu negocio'}
            </p>
            <Notificaciones />
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 text-sm text-ink-soft transition hover:text-rust-500"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-2">
          <Notificaciones />
          <button
            aria-label="Abrir menú"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-line p-2 text-ink"
          >
            <IconMenu />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-surface px-5 py-6 shadow-soft">
            <div className="flex items-center justify-between">
              <Brand compact />
              <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} className="p-1 text-ink-soft">
                <IconClose />
              </button>
            </div>
            <nav className="mt-8 flex flex-col gap-1">
              {navItems.map((item) => (
                <NavItem key={item.to} {...item} onClick={() => setMenuOpen(false)} />
              ))}
            </nav>
            <div className="mt-auto border-t border-line pt-4">
              <p className="truncate text-sm font-semibold text-ink">{profile?.business_name || 'Tu negocio'}</p>
              <button onClick={handleSignOut} className="mt-2 text-sm text-ink-soft hover:text-rust-500">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido */}
      <main className="pb-20 lg:ml-64 lg:pb-8">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <TrialBanner />
          {children}
        </div>
      </main>

      {/* Barra inferior mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        {MOBILE_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              classNames(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                isActive ? 'text-brand-600' : 'text-ink-faint'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, label, icon: Icon, onClick, badge }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        classNames(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
          isActive ? 'bg-brand-500/[0.09] text-brand-700' : 'text-ink-soft hover:bg-ink/[0.04] hover:text-ink'
        )
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="shrink-0 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-600">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function TrialBanner() {
  const { freeForAll, isPaid, trialActive, trialLeftLabel } = usePlan()
  if (isPaid) return null

  // Etapa gratis: avisamos siempre hasta cuándo, y en el último mes el
  // aviso se pone naranja para que nadie se entere el día que se corta.
  if (freeForAll) {
    const dias = freeDaysLeft()
    const ultimoTramo = dias <= 30
    return (
      <div
        className={classNames(
          'mb-5 rounded-xl2 border px-4 py-2.5 text-sm text-ink-soft',
          ultimoTramo
            ? 'border-brass-500/40 bg-brass-500/[0.08]'
            : 'border-teal-500/30 bg-teal-500/[0.07]'
        )}
      >
        {ultimoTramo ? '⏳' : '🎉'} Todas las funciones están{' '}
        <b className={ultimoTramo ? 'text-brass-600' : 'text-teal-600'}>gratis</b> hasta el{' '}
        <b>{FREE_UNTIL_LABEL}</b>
        {ultimoTramo ? ` · quedan ${dias} ${dias === 1 ? 'día' : 'días'}.` : '. ¡Aprovechá!'}
      </div>
    )
  }

  if (trialActive) {
    return (
      <Link
        to="/premium"
        className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-brand-500/25 bg-gradient-to-r from-brand-500/[0.07] to-teal-500/[0.07] px-4 py-2.5 text-sm transition hover:from-brand-500/[0.12]"
      >
        <span className="text-ink-soft">
          ✨ {PROMO_LABEL} gratis · te quedan <b className="text-brand-700">{trialLeftLabel}</b> con todo desbloqueado
        </span>
        <span className="font-medium text-brand-700">Ver planes →</span>
      </Link>
    )
  }

  return (
    <Link
      to="/premium"
      className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl2 border border-brass-500/40 bg-brass-500/[0.08] px-4 py-2.5 text-sm transition hover:bg-brass-500/[0.14]"
    >
      <span className="text-ink-soft">🔒 Tu período gratis terminó · desbloqueá las funciones premium</span>
      <span className="font-semibold text-brass-600">Suscribirme por USD 2/mes →</span>
    </Link>
  )
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/numera-icon.svg" alt="Numera" className="h-8 w-8" />
      {!compact && (
        <span className="font-display text-xl font-medium tracking-tight text-ink">Numera</span>
      )}
      {compact && <span className="font-display text-lg font-medium text-ink">Numera</span>}
    </div>
  )
}

/* Íconos en línea, sin dependencias externas */
function IconGrid(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IconDoc(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 12h6M9 16h4M14 3v4h4" />
    </svg>
  )
}
function IconUsers(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.2a3.2 3.2 0 0 1 0 6.2M21 20c0-2.8-2-5.1-4.6-5.8" />
    </svg>
  )
}
function IconBuilding(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4" y="3" width="12" height="18" rx="1" />
      <path d="M8 7h1M8 11h1M8 15h1M12 7h1M12 11h1M12 15h1M16 11h4v10h-4z" />
    </svg>
  )
}
function IconTag(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l8 8-9 9z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  )
}
function IconChart(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
    </svg>
  )
}
function IconReceipt(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 3v18l2-1.3L9 21l2-1.3L13 21l2-1.3L17 21l2-1.3V3l-2 1.3L15 2l-2 1.3L11 2 9 3.3 7 2 5 3.3z" />
      <path d="M8 8h8M8 12h8" strokeLinecap="round" />
    </svg>
  )
}
function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.5-7.5 9.5-4.4-1-7.5-5.1-7.5-9.5V6z" />
      <path d="M9.2 12.2l2 2 3.6-3.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconGift(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13" />
      <path d="M12 8S10.8 4 8.7 4a2.2 2.2 0 0 0 0 4.4M12 8s1.2-4 3.3-4a2.2 2.2 0 0 1 0 4.4" />
    </svg>
  )
}
function IconHelp(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.3-2.7 4" strokeLinecap="round" />
      <path d="M12 17.2h.01" strokeLinecap="round" />
    </svg>
  )
}
function IconMenu(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}
function IconClose(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
