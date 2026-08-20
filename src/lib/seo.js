import { useEffect } from 'react'

// ------------------------------------------------------------
// SEO de una app de una sola página.
//
// Los buscadores hoy ejecutan JavaScript, así que el título y la
// descripción que ponemos acá los leen bien. Los que NO ejecutan JS son
// los que arman la vista previa del link (WhatsApp, Facebook, X): esos
// solo ven lo que está escrito a mano en index.html. Por eso las etiquetas
// og: de la portada viven ahí y acá solo ajustamos por pantalla.
//
// El otro trabajo de este archivo es al revés del SEO: marcar noindex en
// todo lo que NO tiene que aparecer en Google. Sobre todo /p/<token>, que
// es el presupuesto de un cliente con nombre, precios y teléfono. Google
// no lo va a encontrar solo, pero alcanza con que alguien pegue el link
// en un foro o en una extensión que espía la barra de direcciones.
// ------------------------------------------------------------

export const SITE_NAME = 'Numera'
export const DEFAULT_TITLE = 'Numera · Presupuestos profesionales en minutos'
export const DEFAULT_DESCRIPTION =
  'Hacé presupuestos prolijos y mandalos en PDF por WhatsApp o email. Clientes, ítems, condiciones y seguimiento de aceptados, en una sola app. Probalo gratis.'

function setMeta(attr, key, content) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

export function useSeo({ title, description, noindex = false } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE
    document.title = fullTitle
    setMeta('name', 'description', description || DEFAULT_DESCRIPTION)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description || DEFAULT_DESCRIPTION)

    // Lo que está detrás del login, y el presupuesto de un cliente, no van
    // a Google. `noarchive` además evita la copia en caché.
    setMeta('name', 'robots', noindex ? 'noindex, nofollow, noarchive' : 'index, follow')
  }, [title, description, noindex])
}

// Para lo que está detrás del login: no toca el título, solo pide que
// esta pantalla no se indexe.
export function useNoIndex() {
  useEffect(() => {
    setMeta('name', 'robots', 'noindex, nofollow, noarchive')
  }, [])
}
