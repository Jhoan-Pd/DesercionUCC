/**
 * Protección contra ataques de fuerza bruta en el inicio de sesión.
 * Tras MAX_INTENTOS contraseñas incorrectas seguidas, la cuenta se bloquea MINUTOS_BLOQUEO minutos.
 * El estado vive en la BD (usuarios.intentosFallidos / bloqueadoHasta) para que funcione aunque
 * Vercel ejecute cada petición en una instancia distinta (no sirve un contador en memoria).
 * Funciones puras: se prueban sin base de datos.
 */
export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;

export interface EstadoBloqueo {
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

/** ¿Está bloqueada la cuenta en este momento? Devuelve los minutos que faltan. */
export function consultarBloqueo(estado: EstadoBloqueo, ahora: Date = new Date()): { bloqueado: boolean; minutosRestantes: number } {
  if (!estado.bloqueadoHasta || estado.bloqueadoHasta.getTime() <= ahora.getTime()) return { bloqueado: false, minutosRestantes: 0 };
  return { bloqueado: true, minutosRestantes: Math.ceil((estado.bloqueadoHasta.getTime() - ahora.getTime()) / 60_000) };
}

/** Nuevo estado después de una contraseña incorrecta */
export function registrarFallo(estado: EstadoBloqueo, ahora: Date = new Date()): EstadoBloqueo {
  // Si el bloqueo anterior ya venció, se empieza a contar de nuevo
  const previo = estado.bloqueadoHasta && estado.bloqueadoHasta.getTime() <= ahora.getTime() ? 0 : estado.intentosFallidos;
  const intentos = previo + 1;
  if (intentos >= MAX_INTENTOS) {
    return { intentosFallidos: intentos, bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000) };
  }
  return { intentosFallidos: intentos, bloqueadoHasta: null };
}

/** Estado después de un inicio de sesión correcto */
export const ESTADO_LIMPIO: EstadoBloqueo = { intentosFallidos: 0, bloqueadoHasta: null };

/** Código que viaja en el error de Auth.js para que el formulario muestre el mensaje adecuado */
export const ERROR_CUENTA_BLOQUEADA = "CUENTA_BLOQUEADA";
