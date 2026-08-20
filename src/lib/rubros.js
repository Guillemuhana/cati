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
//
// Si agregás uno nuevo: la `key` no se cambia nunca (queda guardada en
// los perfiles), y 'otro' se queda último.
// ------------------------------------------------------------

export const RUBROS = [
  // ── Obra y oficios ────────────────────────────────────────
  {
    key: 'construccion',
    group: 'Obra y oficios',
    label: 'Construcción y obra',
    fields: ['Dirección de la obra', 'Superficie (m²)', 'Fecha de inicio', 'Plazo de obra'],
    terms:
      'Presupuesto válido por 7 días. Los precios pueden variar según el costo de los materiales al momento de iniciar la obra. No incluye trabajos que no estén detallados en este listado.',
    payment_terms: '50% de anticipo para materiales, 50% contra entrega.',
    payment_methods: 'Transferencia bancaria o efectivo.',
    validity: 7,
    itemPlaceholder: 'Ej: Colocación de cerámico (m²)'
  },
  {
    key: 'arquitectura',
    group: 'Obra y oficios',
    label: 'Arquitectura e ingeniería',
    fields: ['Ubicación del proyecto', 'Superficie (m²)', 'Etapa', 'Municipio'],
    terms:
      'Presupuesto válido por 15 días. Incluye la documentación detallada en el listado. Los trámites, tasas y sellados municipales corren por cuenta del comitente.',
    payment_terms: '30% al encargar, 40% con el anteproyecto, 30% con la documentación final.',
    payment_methods: 'Transferencia bancaria.',
    validity: 15,
    itemPlaceholder: 'Ej: Documentación de obra · plano municipal'
  },
  {
    key: 'oficios',
    group: 'Obra y oficios',
    label: 'Oficios (plomería, electricidad, gas…)',
    fields: ['Dirección del trabajo', 'Fecha de visita', 'Materiales que pone el cliente'],
    terms:
      'Presupuesto válido por 7 días. No incluye materiales, salvo los que estén detallados. Los trabajos adicionales que aparezcan se presupuestan aparte.',
    payment_terms: 'Se abona al finalizar el trabajo.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 7,
    itemPlaceholder: 'Ej: Mano de obra por jornada'
  },
  {
    key: 'carpinteria',
    group: 'Obra y oficios',
    label: 'Carpintería y muebles a medida',
    fields: ['Medidas', 'Material', 'Color / terminación', 'Lugar de entrega'],
    terms:
      'Presupuesto válido por 15 días. Las medidas definitivas se toman en el lugar antes de fabricar. Los precios pueden variar si cambia el costo de los materiales.',
    payment_terms: '50% para arrancar la fabricación, 50% contra entrega e instalación.',
    payment_methods: 'Transferencia o efectivo.',
    validity: 15,
    itemPlaceholder: 'Ej: Mueble bajo mesada 2,40 m'
  },
  {
    key: 'herreria',
    group: 'Obra y oficios',
    label: 'Herrería, metalúrgica y aberturas',
    fields: ['Medidas', 'Material', 'Color / terminación', 'Dirección de colocación'],
    terms:
      'Presupuesto válido por 7 días por la variación del acero y el aluminio. Incluye colocación salvo aclaración. No incluye trabajos de albañilería.',
    payment_terms: '50% de anticipo, 50% contra entrega.',
    payment_methods: 'Transferencia o efectivo.',
    validity: 7,
    itemPlaceholder: 'Ej: Portón corredizo de 3 m'
  },
  {
    key: 'seguridad',
    group: 'Obra y oficios',
    label: 'Seguridad electrónica (cámaras, alarmas)',
    fields: ['Dirección', 'Cantidad de cámaras', 'Tipo de conexión', 'Monitoreo'],
    terms:
      'Presupuesto válido por 15 días. Incluye instalación y configuración. No incluye obra civil ni el servicio de monitoreo mensual, que se cotiza aparte.',
    payment_terms: '50% de anticipo para los equipos, 50% contra instalación.',
    payment_methods: 'Transferencia o efectivo.',
    validity: 15,
    itemPlaceholder: 'Ej: Kit 4 cámaras + instalación'
  },

  // ── Servicios para hogares y empresas ─────────────────────
  {
    key: 'limpieza',
    group: 'Servicios para hogares y empresas',
    label: 'Limpieza y mantenimiento',
    fields: ['Dirección', 'Superficie (m²)', 'Frecuencia', 'Horario'],
    terms:
      'Presupuesto válido por 15 días. Incluye los insumos de limpieza. El servicio se coordina con al menos 48 horas de aviso.',
    payment_terms: 'Se abona al finalizar. Los abonos mensuales, del 1 al 10 de cada mes.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 15,
    itemPlaceholder: 'Ej: Limpieza profunda de oficina (m²)'
  },
  {
    key: 'jardineria',
    group: 'Servicios para hogares y empresas',
    label: 'Jardinería, paisajismo y piletas',
    fields: ['Dirección', 'Superficie (m²)', 'Frecuencia'],
    terms:
      'Presupuesto válido por 15 días. No incluye el retiro de restos de poda ni de escombros, salvo que esté detallado. Las plantas quedan sujetas a disponibilidad del vivero.',
    payment_terms: 'Se abona al finalizar. Los mantenimientos, por mes adelantado.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 15,
    itemPlaceholder: 'Ej: Corte de césped y poda · 200 m²'
  },
  {
    key: 'mudanzas',
    group: 'Servicios para hogares y empresas',
    label: 'Fletes, mudanzas y logística',
    fields: ['Origen', 'Destino', 'Fecha', 'Piso / ascensor'],
    terms:
      'Presupuesto válido por 7 días. El precio corresponde al recorrido y al volumen indicados. Peajes, estacionamiento y esperas de más de 30 minutos se cobran aparte.',
    payment_terms: 'Se abona al finalizar el viaje.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 7,
    itemPlaceholder: 'Ej: Flete CABA → Zona Norte'
  },

  // ── Tecnología y digital ──────────────────────────────────
  {
    key: 'software',
    group: 'Tecnología y digital',
    label: 'Desarrollo de software e inteligencia artificial',
    fields: [
      'Entrega estimada',
      'Alcance del hito',
      'Stack / plataforma',
      'Responsable del cliente'
    ],
    terms:
      'Presupuesto válido por 15 días. Incluye únicamente el alcance detallado en los ítems: todo lo que no esté listado se cotiza aparte. No incluye hosting, dominios, licencias de terceros ni el consumo de APIs de inteligencia artificial, que se factura al costo según el uso real. Se incluyen 2 rondas de ajustes por entrega. El código fuente se entrega con el pago final.',
    payment_terms: '50% al aprobar, 50% contra entrega. En proyectos largos, por hitos mensuales.',
    payment_methods: 'Transferencia bancaria.',
    validity: 15,
    itemPlaceholder: 'Ej: Integración de chatbot con IA'
  },
  {
    key: 'diseno',
    group: 'Tecnología y digital',
    label: 'Diseño gráfico y branding',
    fields: ['Piezas incluidas', 'Formatos de entrega', 'Fecha de entrega'],
    terms:
      'Presupuesto válido por 15 días. Incluye 2 rondas de revisión por pieza. Los archivos editables y la cesión de derechos se entregan con el pago final. Tipografías y fotos con licencia se cotizan aparte.',
    payment_terms: '50% al aprobar, 50% con la entrega de los archivos finales.',
    payment_methods: 'Transferencia bancaria o Mercado Pago.',
    validity: 15,
    itemPlaceholder: 'Ej: Identidad de marca · logo + manual'
  },
  {
    key: 'marketing',
    group: 'Tecnología y digital',
    label: 'Marketing digital y publicidad',
    fields: ['Período del abono', 'Redes incluidas', 'Inversión en pauta'],
    terms:
      'Presupuesto válido por 15 días. Los honorarios no incluyen la inversión publicitaria, que se paga directo a la plataforma. Los resultados dependen de factores externos: no se garantizan cifras.',
    payment_terms: 'Abono mensual por adelantado, del 1 al 10 de cada mes.',
    payment_methods: 'Transferencia bancaria.',
    validity: 15,
    itemPlaceholder: 'Ej: Gestión de redes · 12 posteos al mes'
  },
  {
    key: 'audiovisual',
    group: 'Tecnología y digital',
    label: 'Fotografía y video',
    fields: ['Fecha del evento', 'Lugar', 'Horas de cobertura', 'Material que se entrega'],
    terms:
      'Presupuesto válido por 15 días. Incluye la cantidad de material editado que figura en el listado; el material en bruto no se entrega. La fecha se reserva con la seña.',
    payment_terms: '50% de seña para reservar la fecha, 50% antes de la entrega.',
    payment_methods: 'Transferencia o Mercado Pago.',
    validity: 15,
    itemPlaceholder: 'Ej: Cobertura de evento · 4 horas'
  },
  {
    key: 'tecnologia',
    group: 'Tecnología y digital',
    label: 'Soporte técnico, redes y hardware',
    fields: ['Equipo / modelo', 'Falla reportada', 'Dirección', 'Garantía'],
    terms:
      'Presupuesto válido por 15 días. Incluye el diagnóstico detallado. Los repuestos quedan sujetos a disponibilidad y a variación de precio. Garantía de 90 días sobre el trabajo; no cubre daños por mal uso.',
    payment_terms: 'Se abona al finalizar el trabajo.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 15,
    itemPlaceholder: 'Ej: Cableado de red · 8 puestos'
  },

  // ── Profesionales ─────────────────────────────────────────
  {
    key: 'servicios',
    group: 'Profesionales',
    label: 'Servicios profesionales (consultoría, contable, legal)',
    fields: ['Período', 'Alcance', 'Responsable'],
    terms:
      'Presupuesto válido por 15 días. Los honorarios no incluyen tasas, sellados ni gastos de terceros. El plazo empieza a correr con la documentación completa.',
    payment_terms: '50% al encargar, 50% contra entrega.',
    payment_methods: 'Transferencia bancaria.',
    validity: 15,
    itemPlaceholder: 'Ej: Asesoramiento mensual'
  },
  {
    key: 'educacion',
    group: 'Profesionales',
    label: 'Educación y capacitación',
    fields: ['Modalidad', 'Cantidad de clases', 'Duración de cada clase', 'Días y horario'],
    terms:
      'Presupuesto válido por 30 días. Incluye el material de estudio. Las clases canceladas con menos de 24 horas de aviso se consideran dadas.',
    payment_terms: 'Por mes adelantado, del 1 al 10 de cada mes.',
    payment_methods: 'Transferencia o Mercado Pago.',
    validity: 30,
    itemPlaceholder: 'Ej: Curso de 8 clases · 2 h cada una'
  },
  {
    key: 'salud',
    group: 'Profesionales',
    label: 'Salud y bienestar',
    fields: ['Cantidad de sesiones', 'Frecuencia', 'Modalidad'],
    terms:
      'Presupuesto válido por 30 días. Los turnos cancelados con menos de 24 horas de aviso se cobran igual. No incluye estudios ni medicación.',
    payment_terms: 'Se abona en cada sesión, o el paquete completo por adelantado.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 30,
    itemPlaceholder: 'Ej: Sesión de kinesiología'
  },
  {
    key: 'inmobiliaria',
    group: 'Profesionales',
    label: 'Inmobiliaria y administración',
    fields: ['Dirección del inmueble', 'Tipo de operación', 'Período'],
    terms:
      'Presupuesto válido por 30 días. Los honorarios no incluyen sellados, informes de dominio ni gastos de escritura.',
    payment_terms: 'Se abona al firmar.',
    payment_methods: 'Transferencia bancaria.',
    validity: 30,
    itemPlaceholder: 'Ej: Honorarios por administración mensual'
  },

  // ── Comercio y producción ─────────────────────────────────
  {
    key: 'comercio',
    group: 'Comercio y producción',
    label: 'Comercio y venta de productos',
    fields: ['Forma de entrega', 'Plazo de disponibilidad', 'Garantía'],
    terms: 'Precios sujetos a disponibilidad de stock. Válido por 30 días o hasta agotar existencias.',
    payment_terms: 'Pago contra entrega.',
    payment_methods: 'Efectivo, transferencia, débito y crédito.',
    validity: 30,
    itemPlaceholder: 'Ej: Notebook 14 pulgadas · 8 GB RAM'
  },
  {
    key: 'imprenta',
    group: 'Comercio y producción',
    label: 'Imprenta, cartelería y gráfica',
    fields: ['Medidas', 'Material / papel', 'Cantidad', 'Fecha de entrega'],
    terms:
      'Presupuesto válido por 7 días por la variación del papel y los insumos. La producción arranca con el archivo final aprobado. Puede haber una diferencia de hasta el 10% en la cantidad entregada.',
    payment_terms: '50% de anticipo, 50% contra entrega.',
    payment_methods: 'Transferencia o efectivo.',
    validity: 7,
    itemPlaceholder: 'Ej: 1.000 folletos A5 full color'
  },
  {
    key: 'textil',
    group: 'Comercio y producción',
    label: 'Indumentaria y textil',
    fields: ['Talles', 'Colores', 'Cantidad por talle', 'Fecha de entrega'],
    terms:
      'Presupuesto válido por 15 días. Puede haber una diferencia de hasta el 5% en la cantidad producida. Los cambios de diseño después de aprobada la muestra se cotizan aparte.',
    payment_terms: '50% de anticipo, 50% contra entrega.',
    payment_methods: 'Transferencia o efectivo.',
    validity: 15,
    itemPlaceholder: 'Ej: 50 remeras estampadas'
  },
  {
    key: 'automotor',
    group: 'Comercio y producción',
    label: 'Automotor (taller, chapa y pintura)',
    fields: ['Vehículo', 'Patente', 'Kilometraje', 'Fecha de ingreso'],
    terms:
      'Presupuesto válido por 15 días. Sujeto a revisión: si al desarmar aparecen otras fallas, se avisa antes de continuar. Repuestos sujetos a disponibilidad.',
    payment_terms: 'Se abona al retirar el vehículo.',
    payment_methods: 'Efectivo, transferencia o débito.',
    validity: 15,
    itemPlaceholder: 'Ej: Cambio de correa de distribución'
  },
  {
    key: 'agro',
    group: 'Comercio y producción',
    label: 'Agro, campo y maquinaria',
    fields: ['Establecimiento', 'Superficie (ha)', 'Cultivo / labor', 'Fecha estimada'],
    terms:
      'Presupuesto válido por 7 días. Los precios pueden variar por el combustible y los insumos. No incluye el traslado de maquinaria fuera del radio acordado.',
    payment_terms: 'Se abona al finalizar la labor.',
    payment_methods: 'Transferencia o cheque.',
    validity: 7,
    itemPlaceholder: 'Ej: Siembra · por hectárea'
  },

  // ── Personas y eventos ────────────────────────────────────
  {
    key: 'gastronomia',
    group: 'Personas y eventos',
    label: 'Gastronomía y catering',
    fields: ['Fecha del evento', 'Cantidad de personas', 'Lugar', 'Horario'],
    terms:
      'Presupuesto válido por 30 días. El menú definitivo se confirma 7 días antes del evento y la cantidad de personas se puede ajustar hasta 72 horas antes.',
    payment_terms: '50% de seña para reservar la fecha, 50% el día del evento.',
    payment_methods: 'Transferencia bancaria o efectivo.',
    validity: 30,
    itemPlaceholder: 'Ej: Catering para 50 personas'
  },
  {
    key: 'eventos',
    group: 'Personas y eventos',
    label: 'Eventos, música y espectáculos',
    fields: ['Fecha del evento', 'Lugar', 'Horario', 'Duración'],
    terms:
      'Presupuesto válido por 30 días. La fecha se reserva con la seña. Incluye armado y desarme. El lugar tiene que contar con electricidad y acceso para la descarga.',
    payment_terms: '50% de seña para reservar la fecha, 50% el día del evento.',
    payment_methods: 'Transferencia o efectivo.',
    validity: 30,
    itemPlaceholder: 'Ej: Show en vivo · 2 sets de 45 min'
  },
  {
    key: 'belleza',
    group: 'Personas y eventos',
    label: 'Belleza y estética',
    fields: ['Fecha', 'Lugar', 'Cantidad de personas'],
    terms:
      'Presupuesto válido por 30 días. El turno se reserva con seña y se puede reprogramar avisando con 48 horas.',
    payment_terms: 'Seña para reservar el turno, el resto el día del servicio.',
    payment_methods: 'Efectivo, transferencia o Mercado Pago.',
    validity: 30,
    itemPlaceholder: 'Ej: Maquillaje y peinado para evento'
  },

  // ── Sin especificar (tiene que quedar último) ─────────────
  {
    key: 'otro',
    group: 'Otro',
    label: 'Otro / prefiero no decir',
    fields: [],
    terms: '',
    payment_terms: '',
    payment_methods: '',
    validity: 15,
    itemPlaceholder: 'Ej: Trabajo a realizar'
  }
]

// 'otro' no sugiere nada: es también el comodín para un perfil vacío o
// con una clave vieja que ya no exista.
const FALLBACK = RUBROS.find((r) => r.key === 'otro')

export function getRubro(key) {
  return RUBROS.find((r) => r.key === key) || FALLBACK
}

// Agrupados para los <select>: con esta cantidad, una lista plana no hay
// forma de recorrerla. Respeta el orden en que están escritos arriba.
export const RUBRO_GROUPS = RUBROS.reduce((acc, rubro) => {
  const ultimo = acc[acc.length - 1]
  if (ultimo && ultimo.group === rubro.group) ultimo.rubros.push(rubro)
  else acc.push({ group: rubro.group, rubros: [rubro] })
  return acc
}, [])
