import { useTranslation } from 'react-i18next'

export default function Spinner({ size = 22 }) {
  const { t } = useTranslation()
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-line border-t-brand-500"
      style={{ width: size, height: size }}
      role="status"
      aria-label={t('comun.cargandoAria')}
    />
  )
}
