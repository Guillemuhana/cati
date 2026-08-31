import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './locales/es.json'
import en from './locales/en.json'

/**
 * Los dos idiomas de Numera.
 *
 * El castellano es el original y el que manda: si a una clave le falta la
 * traducción al inglés, sale en castellano en vez de salir el nombre de
 * la clave, que es lo que hace i18next si no se le dice nada.
 *
 * ⚠ LO QUE NO SE TRADUCE, A PROPÓSITO
 *   El acuerdo de confidencialidad y los términos y condiciones de cada
 *   rubro (src/lib/nda.js, src/lib/rubros.js) quedan siempre en
 *   castellano. Son textos que se firman: una traducción de cortesía de
 *   un contrato no es un contrato, y el que lo firma en inglés creería
 *   estar firmando otra cosa. La pantalla que los muestra sí está
 *   traducida, y avisa en inglés que el documento va en castellano.
 */
export const IDIOMAS = [
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'en', label: 'English', short: 'EN' }
]

export const IDIOMA_POR_DEFECTO = 'es'

// La clave del navegador. Con nombre propio: localStorage lo comparten
// todas las apps del mismo dominio.
export const CLAVE_IDIOMA = 'numera.idioma'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en }
    },
    fallbackLng: IDIOMA_POR_DEFECTO,
    supportedLngs: IDIOMAS.map((i) => i.code),
    // 'es-AR' y 'es-419' tienen que caer en 'es'. Sin esto i18next busca
    // un catálogo 'es-AR' que no existe y se va al fallback.
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: CLAVE_IDIOMA,
      caches: ['localStorage']
    },
    interpolation: {
      // React ya escapa todo lo que interpola en el JSX. Que i18next lo
      // vuelva a escapar deja «&amp;» y «&#39;» a la vista en pantalla.
      escapeValue: false
    },
    returnNull: false
  })

// El idioma del documento no es decoración: de ahí sacan el idioma el
// lector de pantalla, el traductor del navegador y el corrector.
const marcarIdioma = (lng) => {
  document.documentElement.lang = lng || IDIOMA_POR_DEFECTO
}
marcarIdioma(i18n.resolvedLanguage)
i18n.on('languageChanged', marcarIdioma)

export default i18n
