import { esRol, type Rol } from "@/lib/roles";

/**
 * Revalidación de la sesión contra la base de datos.
 *
 * La sesión es un JWT firmado que dura 8 horas. Sin revalidar, una cuenta desactivada seguiría
 * entrando hasta que el token expire y un cambio de rol no se aplicaría hasta volver a iniciar
 * sesión. Por eso, en cada petición del servidor se consulta la cuenta (una lectura por clave
 * primaria) y se decide aquí, en una función pura y probada, si la sesión sigue siendo válida.
 */
export interface CuentaActual {
  activo: boolean;
  rol: string;
}

export type ResultadoRevalidacion = { valida: false; motivo: "inexistente" | "inactiva" | "rol-invalido" } | { valida: true; rol: Rol };

export function revalidarSesion(cuenta: CuentaActual | null): ResultadoRevalidacion {
  if (!cuenta) return { valida: false, motivo: "inexistente" };
  if (!cuenta.activo) return { valida: false, motivo: "inactiva" };
  if (!esRol(cuenta.rol)) return { valida: false, motivo: "rol-invalido" };
  return { valida: true, rol: cuenta.rol };
}
