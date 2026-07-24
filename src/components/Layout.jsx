import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { classNames } from '../lib/utils'

const NAV_ITEMS = [
  { to: '/panel', label: 'Panel', icon: IconGrid },
  { to: '/presupuestos', label: 'Presupuestos', icon: IconDoc },
  { to: '/catalogo', label: 'Catálogo', icon: IconTag },
  { to: '/clientes', label: 'Clientes', icon: IconUsers },
  { to: '/reportes', label: 'Reportes', icon: IconChart },
  { to: '/perfil', label: 'Mi negocio', icon: IconBuilding }
]

// Accesos rápidos en la barra inferior de celular (el resto está en el menú).
const MOBILE_ITEMS = [
  { to: '/panel', label: 'Panel', icon: IconGrid },
  { to: '/presupuestos', label: 'Presup.', icon: IconDoc },
  { to: '/catalogo', label: 'Catálogo', icon: IconTag },
  { to: '/clientes', label: 'Clientes', icon: IconUsers }
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

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
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="border-t border-line pt-4">
          <p className="truncate font-sans text-sm font-semibold text-ink">
            {profile?.business_name || 'Tu negocio'}
          </p>
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
        <button
          aria-label="Abrir menú"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg border border-line p-2 text-ink"
        >
          <IconMenu />
        </button>
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
              {NAV_ITEMS.map((item) => (
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
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">{children}</div>
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

function NavItem({ to, label, icon: Icon, onClick }) {
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
      {label}
    </NavLink>
  )
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/cati-icon.svg" alt="Cati" className="h-8 w-8" />
      {!compact && (
        <span className="font-display text-xl font-medium tracking-tight text-ink">Cati</span>
      )}
      {compact && <span className="font-display text-lg font-medium text-ink">Cati</span>}
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
