/**
 * Freno a los intentos de ingreso, del lado del navegador.
 *
 * ⚠ QUÉ ES Y QUÉ NO ES ESTO
 *   Esto NO es la defensa contra la fuerza bruta. Cualquiera que ataque
 *   en serio no usa nuestra pantalla: le pega directo al endpoint de
 *   Supabase con curl, donde este archivo no existe. La defensa de
 *   verdad es el hook `password_verification_attempt` de la migración 30,
 *   que corre en la base y bloquea la cuenta aunque el intento venga de
 *   afuera de la app.
 *
 *   Lo que sí hace este archivo es lo que el servidor no puede hacer
 *   bien: cortar el chorro antes de que salga. Frena al que prueba
 *   contraseñas a mano, evita gastar el límite de peticiones de Supabase
 *   con intentos que ya sabemos que van a fallar, y —lo más importante—
 *   le dice a la persona cuánto tiene que esperar, en vez de dejarla
 *   golpeando contra un «email o contraseña incorrectos» que de golpe se
 *   convierte en otra cosa.
 *
 * La cuenta va por email y no global: en una compu compartida, que uno se
 * equivoque no tiene por qué trabar al otro.
 */

const CLAVE = 'numera.intentos'

// A partir de cuántos fallos empieza la espera, y cuánto dura cada tramo.
// Crece rápido a propósito: cinco intentos alcanzan de sobra para el que
// se equivocó de verdad, y a partir de ahí cada minuto perdido le
// arruina el negocio al que está probando de a miles.
const TRAMOS = [
  { desde: 12, minutos: 60 },
  { desde: 10, minutos: 15 },
  { desde: 8, minutos: 5 },
  { desde: 5, minutos: 1 }
]

// Después de esto se olvida todo: el que vuelve al día siguiente arranca
// de cero, no arrastrando los errores de tipeo de ayer.
const OLVIDO_MS = 6 * 60 * 60 * 1000

const normalizar = (email) => `${email || ''}`.trim().toLowerCase()

// localStorage puede tirar excepción (ventana privada, cookies
// bloqueadas) o tener basura de otra versión. Nunca puede impedir
// ingresar: ante la duda, se deja pasar.
function leerTodo() {
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    const datos = crudo ? JSON.parse(crudo) : null
    return datos && typeof datos === 'object' ? datos : {}
  } catch {
    return {}
  }
}

function escribirTodo(datos) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(datos))
  } catch {
    // Sin lugar donde anotar, este freno simplemente no existe.
  }
}

function limpiarViejos(datos, ahora) {
  const vivos = {}
  for (const [email, registro] of Object.entries(datos)) {
    if (registro?.ultimo && ahora - registro.ultimo < OLVIDO_MS) vivos[email] = registro
  }
  return vivos
}

/**
 * ¿Puede probar ahora? Devuelve los milisegundos que faltan para poder
 * intentar de nuevo: 0 significa que tiene vía libre.
 */
export function esperaRestante(email) {
  const registro = leerTodo()[normalizar(email)]
  if (!registro?.hasta) return 0
  return Math.max(0, registro.hasta - Date.now())
}

/** Anota un intento fallido y devuelve la espera que le queda. */
export function anotarFallo(email) {
  const clave = normalizar(email)
  if (!clave) return 0

  const ahora = Date.now()
  const datos = limpiarViejos(leerTodo(), ahora)
  const previo = datos[clave] || { fallos: 0 }
  const fallos = previo.fallos + 1

  const tramo = TRAMOS.find((t) => fallos >= t.desde)
  const hasta = tramo ? ahora + tramo.minutos * 60 * 1000 : 0

  datos[clave] = { fallos, ultimo: ahora, hasta }
  escribirTodo(datos)
  return Math.max(0, hasta - ahora)
}

/** Entró bien: se le borra el prontuario. */
export function limpiarIntentos(email) {
  const clave = normalizar(email)
  const datos = limpiarViejos(leerTodo(), Date.now())
  delete datos[clave]
  escribirTodo(datos)
}

/**
 * La espera en la unidad que conviene mostrar. Menos de un minuto en
 * segundos: decirle «esperá 1 minuto» al que espera 8 segundos es
 * mentirle y hace que se vaya.
 */
export function formatoEspera(ms) {
  const segundos = Math.ceil(ms / 1000)
  if (segundos <= 60) return { unidad: 'segundos', valor: segundos }
  return { unidad: 'minutos', valor: Math.ceil(segundos / 60) }
}
