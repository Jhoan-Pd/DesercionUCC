import type { Rol } from "./roles";
import { TODOS } from "./rbac";

export interface Modulo {
  href: string;
  titulo: string;
  descripcion: string;
  icono: "inicio" | "estudiantes" | "agente" | "cifras" | "cargar" | "usuarios";
  roles: Rol[];
}

/** Menú lateral: pocas secciones, centradas en detectar y acompañar a los estudiantes en riesgo */
export const MODULOS: Modulo[] = [
  { href: "/inicio", titulo: "Inicio", descripcion: "Resumen del riesgo de los estudiantes cargados.", icono: "inicio", roles: TODOS },
  { href: "/estudiantes", titulo: "Estudiantes en riesgo", descripcion: "Lista priorizada y ficha de cada estudiante.", icono: "estudiantes", roles: TODOS },
  { href: "/agente", titulo: "Agente IA", descripcion: "Pregúntale al agente por los estudiantes en riesgo.", icono: "agente", roles: TODOS },
  { href: "/cifras-ucc", titulo: "Cifras oficiales UCC", descripcion: "Matrícula oficial de la sede Pasto (datos.gov.co).", icono: "cifras", roles: TODOS },
  { href: "/cargar", titulo: "Cargar datos", descripcion: "Subir el archivo de estudiantes de la universidad.", icono: "cargar", roles: ["ADMIN"] },
  { href: "/usuarios", titulo: "Usuarios", descripcion: "Cuentas de Administrador y Bienestar.", icono: "usuarios", roles: ["ADMIN"] },
];

export function modulosParaRol(rol: Rol): Modulo[] {
  return MODULOS.filter((m) => m.roles.includes(rol));
}
