import type { Rol } from "./roles";

/**
 * Control de acceso por rol (RBAC) — fuente única de verdad.
 * La usan: el middleware (rutas), el menú lateral y los endpoints de la API.
 * Es una lista de prefijos: gana el prefijo más largo que coincida.
 *
 * Habeas data (Ley 1581/2012): los datos INDIVIDUALES de estudiantes solo los ven
 * ADMIN y BIENESTAR (y cada estudiante los suyos). El docente ve solo a sus cursos.
 */
export const TODOS: Rol[] = ["ADMIN", "BIENESTAR", "DOCENTE", "ESTUDIANTE"];

export const REGLAS_RUTAS: { prefijo: string; roles: Rol[] }[] = [
  { prefijo: "/dashboard", roles: ["ADMIN", "BIENESTAR"] },
  { prefijo: "/calculadora", roles: TODOS },
  { prefijo: "/alerta-temprana", roles: ["ADMIN", "BIENESTAR"] },
  { prefijo: "/intervenciones", roles: ["ADMIN", "BIENESTAR"] },
  { prefijo: "/impacto-institucional", roles: ["ADMIN", "BIENESTAR"] },
  { prefijo: "/panel-docente", roles: ["DOCENTE", "ADMIN"] },
  { prefijo: "/encuesta", roles: ["ESTUDIANTE"] },
  { prefijo: "/reportes", roles: ["ADMIN", "BIENESTAR"] },
  { prefijo: "/admin", roles: ["ADMIN"] },
  // API
  { prefijo: "/api/dashboard", roles: ["ADMIN", "BIENESTAR"] },
  { prefijo: "/api/impacto", roles: TODOS },
  { prefijo: "/api/parametros", roles: ["ADMIN"] },
  { prefijo: "/api/riesgo", roles: ["ADMIN", "BIENESTAR"] },
  { prefijo: "/api/alertas", roles: ["DOCENTE", "BIENESTAR", "ADMIN"] },
  { prefijo: "/api/encuesta", roles: ["ESTUDIANTE"] },
  { prefijo: "/api/docente", roles: ["DOCENTE", "ADMIN"] },
];

/** ¿Puede este rol abrir esta ruta? Rutas sin regla => solo requieren sesión. */
export function puedeAcceder(pathname: string, rol: Rol): boolean {
  const regla = REGLAS_RUTAS.filter((r) => pathname === r.prefijo || pathname.startsWith(`${r.prefijo}/`)).sort(
    (a, b) => b.prefijo.length - a.prefijo.length,
  )[0];
  return regla ? regla.roles.includes(rol) : true;
}

/** Página de inicio según el rol */
export function rutaInicial(rol: Rol): string {
  switch (rol) {
    case "ADMIN":
    case "BIENESTAR":
      return "/dashboard";
    case "DOCENTE":
      return "/panel-docente";
    case "ESTUDIANTE":
      return "/calculadora";
  }
}
