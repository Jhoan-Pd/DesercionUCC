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
