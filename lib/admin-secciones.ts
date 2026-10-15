/** Secciones del panel de administración (cada una solo para el rol ADMIN) */
export interface SeccionAdmin {
  href: string;
  titulo: string;
  descripcion: string;
  icono: "parametros" | "programas" | "periodos" | "importar" | "usuarios" | "modelo" | "auditoria";
}

export const SECCIONES_ADMIN: SeccionAdmin[] = [
  { href: "/admin/parametros", titulo: "Parámetros económicos", descripcion: "Salarios de referencia (OLE), costos, tasas, escenarios y valores nacionales de SPADIES.", icono: "parametros" },
  { href: "/admin/programas", titulo: "Programas", descripcion: "Duración, matrícula por semestre y salario de enganche de cada programa.", icono: "programas" },
  { href: "/admin/periodos", titulo: "Periodos académicos", descripcion: "Fechas de cada semestre y cuál es el periodo actual.", icono: "periodos" },
  { href: "/admin/importar", titulo: "Importar estudiantes (CSV)", descripcion: "Carga de datos reales de Registro Académico con validación de columnas.", icono: "importar" },
  { href: "/admin/usuarios", titulo: "Usuarios y roles", descripcion: "Crear cuentas, cambiar roles, desactivar, restablecer contraseñas y desbloquear.", icono: "usuarios" },
  { href: "/admin/auditoria", titulo: "Auditoría de accesos", descripcion: "Quién consultó datos individuales, exportó, importó o cambió la configuración.", icono: "auditoria" },
];
