/** Roles del sistema. Es seguro importarlo desde el middleware (sin dependencias de Node). */
export const ROLES = ["ADMIN", "BIENESTAR", "DOCENTE", "ESTUDIANTE"] as const;
export type Rol = (typeof ROLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: "Administrador",
  BIENESTAR: "Bienestar Universitario",
  DOCENTE: "Docente",
  ESTUDIANTE: "Estudiante",
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}
