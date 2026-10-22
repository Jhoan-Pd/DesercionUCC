import { esRol, type Rol } from "@/lib/roles";

/**
 * Revalidación de la sesión contra la base de datos.
 *
 * La sesión es un JWT firmado que dura 8 horas. Sin revalidar, una cuenta desactivada seguiría
 * entrando hasta que el token expire y un cambio de rol no se aplicaría hasta volver a iniciar
 * sesión. Por eso, en cada petición del servidor se consulta la cuenta (una lectura por clave
 * primaria) y se decide aquí, en una función pura y probada, si la sesión sigue siendo válida.
 * Lo mismo con la contraseña: si se restablece, las sesiones abiertas con la anterior se cierran.
 */
export interface CuentaActual {
  activo: boolean;
  rol: string;
  /** Huella de la contraseña ACTUAL (lib/seguridad/contrasenas.ts → huellaContrasena) */
  huella: string;
}

export type MotivoRevocacion = "inexistente" | "inactiva" | "rol-invalido" | "contrasena-cambiada";

export type ResultadoRevalidacion = { valida: false; motivo: MotivoRevocacion } | { valida: true; rol: Rol };

/**
 * @param huellaSesion huella de la contraseña con la que se inició la sesión. Las sesiones creadas
 *   antes de que existiera la huella no la traen y se siguen aceptando hasta que expiren (8 horas).
 */
export function revalidarSesion(cuenta: CuentaActual | null, huellaSesion?: string): ResultadoRevalidacion {
  if (!cuenta) return { valida: false, motivo: "inexistente" };
  if (!cuenta.activo) return { valida: false, motivo: "inactiva" };
  if (!esRol(cuenta.rol)) return { valida: false, motivo: "rol-invalido" };
  if (huellaSesion !== undefined && huellaSesion !== cuenta.huella) return { valida: false, motivo: "contrasena-cambiada" };
  return { valida: true, rol: cuenta.rol };
}
