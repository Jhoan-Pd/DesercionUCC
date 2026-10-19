/**
 * Correo y contraseña del primer administrador, leídos de variables de entorno.
 * No hay contraseña por defecto: si no se define, el despliegue avisa y no crea la cuenta
 * (una contraseña escrita en el código terminaría publicada en el repositorio).
 */
export const CORREO_ADMIN_POR_DEFECTO = "admin@ucc.edu.co";

export interface CuentaInicial {
  email: string;
  password: string;
}

export function cuentaInicial(env: Record<string, string | undefined>): CuentaInicial {
  // SEED_DEMO_PASSWORD se acepta por compatibilidad con los despliegues anteriores
  const password = env.SEED_ADMIN_PASSWORD ?? env.SEED_DEMO_PASSWORD;
  if (!password) {
    throw new Error("Define SEED_ADMIN_PASSWORD (contraseña del primer administrador) para crear la cuenta inicial.");
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres, con letras y números.");
  }
  const email = (env.SEED_ADMIN_EMAIL ?? CORREO_ADMIN_POR_DEFECTO).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("SEED_ADMIN_EMAIL no es un correo válido.");
  return { email, password };
}
