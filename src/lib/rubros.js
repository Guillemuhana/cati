// ------------------------------------------------------------
// Rubros: el usuario elige el suyo al registrarse (o en Mi negocio)
// y con eso arrancan escritos los textos que hoy nacen vacíos.
//
// REGLA: esto es un PUNTO DE PARTIDA, nunca una regla. Lo que el
// usuario cargó en Mi negocio siempre gana; el rubro solo rellena
// lo que quedó en blanco. Nada acá esconde funciones de la app.
//
// A propósito NO sugerimos IVA: mucho usuario es monotributista y
// meterle 21% por defecto le mete un error en el PDF del cliente.
// ------------------------------------------------------------

export const RUBROS = [
  {
    key: 'construccion',
    label: 'Construcción y obra',
    terms:
      'Presupuesto válido por 7 días. Los precios pueden variar según el costo de los materiales al momento de iniciar la obra. No incluye trabajos que no estén detallados en este listado.',
    payment_terms: '50% de anticipo para materiales, 50% contra entrega.',
    payment_methods: 'Transferencia bancaria o efectivo.',
    validity: 7,
    itemPlaceholder: 'Ej: Colocación de cerámico (m²)'
  },
  {
    key: 'oficios',
    label: 'Oficios (plomería, electricidad, gas…)',
    terms:
      'Presupuesto válido por 7 días. No incluye materiales, salvo los que estén detallados. Los trabajos adicionales que aparezcan se presupuestan aparte.',
    payment_terms: 'Se abona al finalizar el trabajo.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 7,
    itemPlaceholder: 'Ej: Mano de obra por jornada'
  },
  {
    key: 'servicios',
    label: 'Servicios profesionales (diseño, marketing, consultoría…)',
    terms:
      'Presupuesto válido por 15 días. Incluye 2 rondas de revisión; los cambios de alcance se cotizan aparte.',
    payment_terms: '50% al aprobar, 50% contra entrega.',
    payment_methods: 'Transferencia bancaria.',
    validity: 15,
    itemPlaceholder: 'Ej: Diseño de landing page'
  },
  {
    key: 'comercio',
    label: 'Comercio y venta de productos',
    terms: 'Precios sujetos a disponibilidad de stock. Válido por 30 días o hasta agotar existencias.',
    payment_terms: 'Pago contra entrega.',
    payment_methods: 'Efectivo, transferencia, débito y crédito.',
    validity: 30,
    itemPlaceholder: 'Ej: Notebook 14" · 8 GB RAM'
  },
  {
    key: 'gastronomia',
    label: 'Gastronomía y eventos',
    terms:
      'Presupuesto válido por 30 días. El menú definitivo se confirma 7 días antes del evento y la cantidad de personas se puede ajustar hasta 72 horas antes.',
    payment_terms: '50% de seña para reservar la fecha, 50% el día del evento.',
    payment_methods: 'Transferencia bancaria o efectivo.',
    validity: 30,
    itemPlaceholder: 'Ej: Catering para 50 personas'
  },
  {
    key: 'automotor',
    label: 'Automotor (taller, chapa y pintura)',
    terms:
      'Presupuesto válido por 15 días. Sujeto a revisión: si al desarmar aparecen otras fallas, se avisa antes de continuar. Repuestos sujetos a disponibilidad.',
    payment_terms: 'Se abona al retirar el vehículo.',
    payment_methods: 'Efectivo, transferencia o débito.',
    validity: 15,
    itemPlaceholder: 'Ej: Cambio de correa de distribución'
  },
  {
    key: 'otro',
    label: 'Otro / prefiero no decir',
    terms: '',
    payment_terms: '',
    payment_methods: '',
    validity: 15,
    itemPlaceholder: 'Ej: Trabajo a realizar'
  }
]

const FALLBACK = RUBROS[RUBROS.length - 1] // 'otro': no sugiere nada

// Devuelve siempre un rubro válido, aunque el perfil venga vacío o
// con una clave vieja que ya no existe.
export function getRubro(key) {
  return RUBROS.find((r) => r.key === key) || FALLBACK
}
