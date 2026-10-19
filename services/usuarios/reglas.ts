import type { Rol } from "@/lib/roles";

/**
 * Reglas para administrar cuentas (funciones puras, probadas en tests/usuarios-reglas.test.ts):
 *  - nadie puede desactivarse ni quitarse el rol de administrador a sí mismo;
 *  - el sistema nunca se queda sin un administrador activo.
 */
export interface CambioCuenta {
  rol?: Rol;
  activo?: boolean;
}

export function validarCambio(params: { actorId: string; objetivo: { id: string; rol: Rol; activo: boolean }; cambio: CambioCuenta; adminsActivos: number }): string | null {
  const { actorId, objetivo, cambio, adminsActivos } = params;
  const esUnoMismo = actorId === objetivo.id;
  if (esUnoMismo && cambio.activo === false) return "No puedes desactivar tu propia cuenta.";
  if (esUnoMismo && cambio.rol && cambio.rol !== "ADMIN") return "No puedes quitarte el rol de administrador.";
  const dejaDeSerAdminActivo = objetivo.rol === "ADMIN" && objetivo.activo && (cambio.activo === false || (cambio.rol !== undefined && cambio.rol !== "ADMIN"));
  if (dejaDeSerAdminActivo && adminsActivos <= 1) return "Debe quedar al menos un administrador activo.";
  return null;
}
