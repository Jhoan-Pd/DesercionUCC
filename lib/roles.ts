/** Roles del sistema. Es seguro importarlo desde el middleware (sin dependencias de Node). */
export const ROLES = ["ADMIN", "BIENESTAR"] as const;
export type Rol = (typeof ROLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: "Administrador",
  BIENESTAR: "Bienestar Universitario",
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}
