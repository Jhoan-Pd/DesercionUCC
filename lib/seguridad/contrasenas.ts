import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Costo de bcrypt (2^10 rondas): unos 70 ms por contraseña en el servidor, suficiente para frenar
 * ataques de diccionario sin hacer lento el inicio de sesión. Un solo valor para la cuenta inicial,
 * las cuentas nuevas y los restablecimientos.
 */
export const COSTO_BCRYPT = 10;

export function cifrarContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, COSTO_BCRYPT);
}

/**
 * Hash bcrypt de una contraseña aleatoria que nadie conoce (mismo costo que las cuentas reales).
 * Se compara contra él cuando el correo no existe o la cuenta está inactiva, para que la respuesta
 * tarde lo mismo: sin esto, un correo inexistente respondía en ~7 ms y uno real en ~120 ms, y
 * cualquiera podía averiguar qué correos tienen cuenta midiendo el tiempo.
 */
export const HASH_FICTICIO = "$2a$10$c64DIzXmugNWIR53Is8.DO59Rdtfj9kKZOpfgZNiVqIq0art6OGOO";

/** Verifica la contraseña siempre con bcrypt, exista o no la cuenta (tiempo de respuesta constante) */
export async function verificarContrasena(contrasena: string, hash: string | null): Promise<boolean> {
  const coincide = await bcrypt.compare(contrasena, hash ?? HASH_FICTICIO);
  return hash !== null && coincide;
}

/**
 * Huella corta del hash de la contraseña. Viaja en el JWT de la sesión: si el hash cambia
 * (alguien restableció la contraseña), la huella ya no coincide y las sesiones abiertas se cierran.
 * No revela nada útil: es un resumen SHA-256 del hash bcrypt, que a su vez no se puede invertir.
 */
export function huellaContrasena(hash: string): string {
  return createHash("sha256").update(hash).digest("hex").slice(0, 16);
}
