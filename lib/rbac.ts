import type { Rol } from "./roles";

/**
 * Control de acceso por rol (RBAC) — fuente única de verdad.
 * La usan: el middleware (rutas), el menú lateral y los endpoints de la API.
 * Es una lista de prefijos: gana el prefijo más largo que coincida.
 *
 * Habeas data (Ley 1581/2012): solo el personal autorizado (ADMIN y BIENESTAR) inicia sesión;
 * cargar o borrar información y gestionar cuentas es exclusivo del administrador.
 */
export const TODOS: Rol[] = ["ADMIN", "BIENESTAR"];

export const REGLAS_RUTAS: { prefijo: string; roles: Rol[] }[] = [
  { prefijo: "/inicio", roles: TODOS },
  { prefijo: "/estudiantes", roles: TODOS },
  { prefijo: "/agente", roles: TODOS },
  { prefijo: "/cifras-ucc", roles: TODOS },
  { prefijo: "/cargar", roles: ["ADMIN"] },
  { prefijo: "/usuarios", roles: ["ADMIN"] },
  // API
  { prefijo: "/api/estudiantes", roles: TODOS },
  { prefijo: "/api/agente", roles: TODOS },
  { prefijo: "/api/cargas", roles: ["ADMIN"] },
  { prefijo: "/api/usuarios", roles: ["ADMIN"] },
];

/** Prefijos que exigen sesión (los usa el matcher del middleware) */
export const PREFIJOS_PROTEGIDOS = REGLAS_RUTAS.map((r) => r.prefijo);

/** ¿Puede este rol abrir esta ruta? Rutas sin regla => solo requieren sesión. */
export function puedeAcceder(pathname: string, rol: Rol): boolean {
  const regla = REGLAS_RUTAS.filter((r) => pathname === r.prefijo || pathname.startsWith(`${r.prefijo}/`)).sort(
    (a, b) => b.prefijo.length - a.prefijo.length,
  )[0];
  return regla ? regla.roles.includes(rol) : true;
}

/** Página de inicio después de iniciar sesión (igual para los dos roles) */
export function rutaInicial(_rol: Rol): string {
  return "/inicio";
}
