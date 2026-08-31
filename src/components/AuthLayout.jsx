import { useTranslation } from 'react-i18next'
import SelectorIdioma from './SelectorIdioma'

export default function AuthLayout({ title, subtitle, children }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh bg-paper">
      {/* Panel con foto: solo en pantallas anchas, donde hay lugar de sobra */}
      <div className="relative hidden w-1/2 lg:block">
        <img src="/fondo.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700/85 via-brand-600/75 to-ink/80" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="whitespace-pre-line font-display text-3xl font-medium leading-tight">
            {t('auth.panelFrase')}
          </p>
          <p className="mt-3 max-w-sm text-sm text-white/75">{t('auth.panelDetalle')}</p>
        </div>
      </div>

      <div className="relative flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        {/* Arriba a la derecha y fuera de la tarjeta: es una preferencia
            de la visita, no un campo del formulario. */}
        <div className="absolute right-4 top-4">
          <SelectorIdioma compacto />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src="/logo-numera.png" alt="Numera" className="mb-6 h-28 w-auto object-contain" />
            <h1 className="font-display text-2xl font-medium text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <div className="rounded-xl2 border border-line bg-surface p-6 shadow-soft sm:p-8">{children}</div>
          <p className="mt-6 text-center text-xs text-ink-faint">
            {t('auth.desarrollo')} <span className="font-medium text-ink-soft">sTuDiO-B2B</span>
          </p>
        </div>
      </div>
    </div>
  )
}
