/**
 * Reglas de negocio de la administración (funciones puras, sin BD).
 */

/** Año del primer periodo del sistema: el índice 0 es 2018-1 (igual que el seed) */
export const ANIO_BASE_PERIODOS = 2018;

/** Posición cronológica de un periodo: 2018-1 = 0, 2018-2 = 1, 2019-1 = 2... */
export function indicePeriodo(anio: number, semestre: number): number {
  return (anio - ANIO_BASE_PERIODOS) * 2 + (semestre - 1);
}

export function codigoPeriodo(anio: number, semestre: number): string {
  return `${anio}-${semestre}`;
}

/** Fechas de un periodo: el fin después del inicio, el inicio en el año del periodo y duración razonable */
export function validarFechasPeriodo(anio: number, inicio: Date, fin: Date): string | null {
  if (fin.getTime() <= inicio.getTime()) return "La fecha de fin debe ser posterior a la de inicio";
  if (inicio.getUTCFullYear() !== anio) return `La fecha de inicio debe estar en el año ${anio}`;
  const dias = (fin.getTime() - inicio.getTime()) / 86_400_000;
  if (dias < 60 || dias > 200) return "Un periodo académico debe durar entre 60 y 200 días";
  return null;
}

/** Política de contraseñas: mínimo 8 caracteres con letras y números */
export function validarContrasena(clave: string): string | null {
  if (clave.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(clave) || !/\d/.test(clave)) return "La contraseña debe combinar letras y números";
  return null;
}

export interface CambioUsuario {
  /** ¿El usuario que se modifica es el mismo que hace el cambio? */
  esUnoMismo: boolean;
  rolActual: string;
  rolNuevo?: string;
  activoActual: boolean;
  activoNuevo?: boolean;
  /** Administradores activos en el sistema (incluido el que se modifica, si lo es) */
  adminsActivos: number;
}

/**
 * Evita dejar el sistema sin administración: nadie se desactiva ni se quita el rol ADMIN a sí mismo,
 * y no se puede desactivar o degradar al último administrador activo.
 */
export function validarCambioUsuario(c: CambioUsuario): string | null {
  const desactiva = c.activoNuevo === false && c.activoActual;
  const cambiaRol = c.rolNuevo !== undefined && c.rolNuevo !== c.rolActual;
  if (c.esUnoMismo && desactiva) return "No puedes desactivar tu propia cuenta";
  if (c.esUnoMismo && cambiaRol) return "No puedes cambiar tu propio rol";
  const dejaDeSerAdmin = c.rolActual === "ADMIN" && c.activoActual && (desactiva || cambiaRol);
  if (dejaDeSerAdmin && c.adminsActivos <= 1) return "Debe quedar al menos un administrador activo";
  return null;
}
