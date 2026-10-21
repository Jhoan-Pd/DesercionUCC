import type { Rol } from "./roles";
import { TODOS } from "./rbac";

export interface Modulo {
  href: string;
  titulo: string;
  /** Nombre corto para la barra de navegación */
  corto: string;
  descripcion: string;
  roles: Rol[];
}

/** Secciones de la barra de navegación (el orden da el número de la ceja: [01], [02]…): pocas secciones, centradas en detectar y acompañar a los estudiantes en riesgo */
export const MODULOS: Modulo[] = [
  { href: "/inicio", titulo: "Inicio", corto: "Inicio", descripcion: "Resumen del riesgo de los estudiantes cargados.", roles: TODOS },
  { href: "/estudiantes", titulo: "Estudiantes en riesgo", corto: "Estudiantes", descripcion: "Lista priorizada y ficha de cada estudiante.", roles: TODOS },
  { href: "/agente", titulo: "Agente IA", corto: "Agente IA", descripcion: "Pregúntale al agente por los estudiantes en riesgo.", roles: TODOS },
  { href: "/cifras-ucc", titulo: "Cifras oficiales UCC", corto: "Cifras UCC", descripcion: "Matrícula oficial de la sede Pasto (datos.gov.co).", roles: TODOS },
  { href: "/cargar", titulo: "Cargar datos", corto: "Cargar datos", descripcion: "Subir el archivo de estudiantes de la universidad.", roles: ["ADMIN"] },
  { href: "/usuarios", titulo: "Usuarios", corto: "Usuarios", descripcion: "Cuentas de Administrador y Bienestar.", roles: ["ADMIN"] },
];

export function modulosParaRol(rol: Rol): Modulo[] {
  return MODULOS.filter((m) => m.roles.includes(rol));
}

/** Ceja de la sección para el encabezado de página: número según el orden del menú y nombre de la sección */
export function cejaDe(href: string): { numero: string; nombre: string } | null {
  const i = MODULOS.findIndex((m) => m.href === href);
  return i < 0 ? null : { numero: String(i + 1).padStart(2, "0"), nombre: MODULOS[i].titulo };
}
