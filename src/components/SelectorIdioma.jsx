import { useTranslation } from 'react-i18next'
import { IDIOMAS } from '../i18n'

/**
 * El botón para pasar de castellano a inglés.
 *
 * Dos botones a la vista y no un desplegable: con dos idiomas, un
 * desplegable esconde la mitad de la respuesta y obliga a un toque de
 * más. Va con el idioma escrito en su propio idioma («English», no
 * «Inglés»): el que no entiende la pantalla igual reconoce su palabra.
 *
 * La elección la guarda i18next en localStorage, así que la próxima
 * visita ya entra en el idioma elegido sin pedir nada.
 */
export default function SelectorIdioma({ className = '', compacto = false }) {
  const { t, i18n } = useTranslation()
  const actual = i18n.resolvedLanguage

  return (
    <div
      className={`inline-flex items-center rounded-md border border-line bg-surface/80 p-0.5 ${className}`}
      role="group"
      aria-label={t('idioma.cambiar')}
    >
      {IDIOMAS.map((idioma) => {
        const activo = actual === idioma.code
        return (
          <button
            key={idioma.code}
            type="button"
            onClick={() => i18n.changeLanguage(idioma.code)}
            // aria-current y no aria-pressed: no son dos interruptores
            // sueltos, es una sola opción entre varias.
            aria-current={activo ? 'true' : undefined}
            lang={idioma.code}
            title={idioma.label}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              activo ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {compacto ? idioma.short : idioma.label}
          </button>
        )
      })}
    </div>
  )
}
