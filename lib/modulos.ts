import type { Rol } from "./roles";
import { TODOS } from "./rbac";

export interface Modulo {
  href: string;
  titulo: string;
  descripcion: string;
  icono: "dashboard" | "calculadora" | "alerta" | "encuesta" | "docente" | "intervenciones" | "institucional" | "reportes" | "admin";
  roles: Rol[];
  /** Fase del plan en la que se entrega */
  fase: 1 | 2 | 3;
}

/** Menú lateral y páginas "próximamente". Los módulos con fase > FASE_ACTUAL aparecen deshabilitados. */
export const FASE_ACTUAL = 2;

export const MODULOS: Modulo[] = [
  { href: "/dashboard", titulo: "Dashboard institucional", descripcion: "Deserción por cohorte, programa, semestre y periodo; curvas de supervivencia y causas.", icono: "dashboard", roles: ["ADMIN", "BIENESTAR"], fase: 1 },
  { href: "/calculadora", titulo: "Calculadora de impacto", descripcion: "¿Qué pasa si me retiro? Dinero invertido, deuda y costo de oportunidad.", icono: "calculadora", roles: TODOS, fase: 1 },
  { href: "/alerta-temprana", titulo: "Alerta temprana", descripcion: "Puntaje de riesgo 0-100 por estudiante con explicación de factores.", icono: "alerta", roles: ["ADMIN", "BIENESTAR"], fase: 2 },
  { href: "/encuesta", titulo: "Encuesta de autoevaluación", descripcion: "Conoce tu nivel de riesgo y los recursos disponibles.", icono: "encuesta", roles: ["ESTUDIANTE"], fase: 2 },
  { href: "/panel-docente", titulo: "Panel docente", descripcion: "Estudiantes con bajo rendimiento o inasistencia; reporte de alertas.", icono: "docente", roles: ["DOCENTE", "ADMIN"], fase: 2 },
  { href: "/intervenciones", titulo: "Intervenciones", descripcion: "Registro de acciones de Bienestar y medición de su efectividad.", icono: "intervenciones", roles: ["ADMIN", "BIENESTAR"], fase: 3 },
  { href: "/impacto-institucional", titulo: "Impacto institucional", descripcion: "Ingresos por matrícula dejados de percibir y proyección de mejora.", icono: "institucional", roles: ["ADMIN", "BIENESTAR"], fase: 3 },
  { href: "/reportes", titulo: "Reportes", descripcion: "Exportación en PDF y Excel con datos anonimizados.", icono: "reportes", roles: ["ADMIN", "BIENESTAR"], fase: 3 },
  { href: "/admin", titulo: "Administración", descripcion: "Parámetros, programas, periodos, usuarios, modelo de riesgo, importación CSV y auditoría.", icono: "admin", roles: ["ADMIN"], fase: 1 },
];

export function modulosParaRol(rol: Rol): Modulo[] {
  return MODULOS.filter((m) => m.roles.includes(rol));
}
