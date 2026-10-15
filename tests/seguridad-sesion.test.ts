import { describe, expect, it } from "vitest";
import { revalidarSesion } from "@/lib/seguridad/sesion";

describe("revalidarSesion", () => {
  it("una cuenta activa conserva la sesión con su rol ACTUAL de la base de datos", () => {
    expect(revalidarSesion({ activo: true, rol: "BIENESTAR", estudianteId: null })).toEqual({ valida: true, rol: "BIENESTAR", estudianteId: null });
  });

  it("aplica un cambio de rol sin cerrar sesión", () => {
    const r = revalidarSesion({ activo: true, rol: "DOCENTE", estudianteId: null });
    expect(r.valida && r.rol).toBe("DOCENTE");
  });

  it("una cuenta desactivada o eliminada pierde la sesión de inmediato", () => {
    expect(revalidarSesion({ activo: false, rol: "ADMIN", estudianteId: null })).toEqual({ valida: false, motivo: "inactiva" });
    expect(revalidarSesion(null)).toEqual({ valida: false, motivo: "inexistente" });
  });

  it("un rol desconocido invalida la sesión", () => {
    expect(revalidarSesion({ activo: true, rol: "SUPERUSUARIO", estudianteId: null })).toEqual({ valida: false, motivo: "rol-invalido" });
  });
});
