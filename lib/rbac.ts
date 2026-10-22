import { ROLES, type Rol } from "./roles";

/**
 * Control de acceso por rol (RBAC) — fuente única de verdad.
 * La usan: el middleware (rutas), el layout y los endpoints de la API.
 * Es una lista de prefijos: gana el prefijo más largo que coincida.
 *
 * Habeas data (Ley 1581/2012): solo el personal autorizado (ADMIN y BIENESTAR) inicia sesión;
 * cargar o borrar información y gestionar cuentas es exclusivo del administrador.
 */
/** Los dos roles: es la misma lista de lib/roles.ts, con un nombre que se lee bien en las reglas */
export const TODOS: readonly Rol[] = ROLES;

export const REGLAS_RUTAS: readonly { readonly prefijo: string; readonly roles: readonly Rol[] }[] = [
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

/** Reglas ordenadas una sola vez del prefijo más largo al más corto: la primera que coincide es la más específica */
const REGLAS_POR_ESPECIFICIDAD = [...REGLAS_RUTAS].sort((a, b) => b.prefijo.length - a.prefijo.length);

/** ¿Puede este rol abrir esta ruta? Rutas sin regla => solo requieren sesión. */
export function puedeAcceder(pathname: string, rol: Rol): boolean {
  // El middleware llama esto en cada petición: un recorrido lineal, sin filtrar ni ordenar cada vez
  const regla = REGLAS_POR_ESPECIFICIDAD.find((r) => pathname === r.prefijo || pathname.startsWith(`${r.prefijo}/`));
  return regla ? regla.roles.includes(rol) : true;
}

/** Página de inicio después de iniciar sesión (igual para los dos roles) */
export const RUTA_INICIAL = "/inicio";
