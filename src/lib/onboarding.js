// ------------------------------------------------------------
// Las marcas de la guía de arranque.
//
// Viven en el navegador a propósito: son ayudas de interfaz, no datos
// del negocio. No justifican una columna en la base ni una migración, y
// si alguien entra desde otro teléfono lo peor que pasa es que vuelva a
// ver la guía un rato.
//
// Lo que sí es dato de verdad —si tiene nombre el negocio, si ya cargó
// un cliente, si el cliente abrió el presupuesto— se lee de la base y no
// de acá. Ver PrimerosPasos.jsx.
// ------------------------------------------------------------

export const CLAVES = {
  bienvenidaSaltada: 'numera.bienvenida.saltada',
  pasosOcultos: 'numera.primerosPasos.oculta',
  yaCompartio: 'numera.yaCompartio'
}

export function marcar(clave) {
  try {
    localStorage.setItem(clave, '1')
  } catch {
    // Navegador con el almacenamiento bloqueado: la guía se va a repetir,
    // que es molesto pero inofensivo.
  }
}

export function estaMarcado(clave) {
  try {
    return localStorage.getItem(clave) === '1'
  } catch {
    return false
  }
}
