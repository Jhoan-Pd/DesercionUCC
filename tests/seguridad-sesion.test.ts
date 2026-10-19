import { describe, expect, it } from "vitest";
import { revalidarSesion } from "@/lib/seguridad/sesion";
import { puedeAcceder, rutaInicial } from "@/lib/rbac";
import { esRol } from "@/lib/roles";

describe("revalidarSesion", () => {
  it("una cuenta activa conserva la sesión con su rol ACTUAL de la base de datos", () => {
    expect(revalidarSesion({ activo: true, rol: "BIENESTAR" })).toEqual({ valida: true, rol: "BIENESTAR" });
  });

  it("aplica un cambio de rol sin cerrar sesión", () => {
    const r = revalidarSesion({ activo: true, rol: "ADMIN" });
    expect(r.valida && r.rol).toBe("ADMIN");
  });

  it("una cuenta desactivada o eliminada pierde la sesión de inmediato", () => {
    expect(revalidarSesion({ activo: false, rol: "ADMIN" })).toEqual({ valida: false, motivo: "inactiva" });
    expect(revalidarSesion(null)).toEqual({ valida: false, motivo: "inexistente" });
  });

  it("los roles eliminados (DOCENTE, ESTUDIANTE) ya no son válidos", () => {
    expect(revalidarSesion({ activo: true, rol: "DOCENTE" })).toEqual({ valida: false, motivo: "rol-invalido" });
    expect(esRol("ESTUDIANTE")).toBe(false);
  });
});

describe("permisos por rol", () => {
  it("Bienestar consulta el riesgo y usa el agente, pero no carga datos ni gestiona cuentas", () => {
    for (const r of ["/inicio", "/estudiantes", "/estudiantes/123", "/agente", "/cifras-ucc", "/api/estudiantes", "/api/agente"]) expect(puedeAcceder(r, "BIENESTAR")).toBe(true);
    for (const r of ["/cargar", "/usuarios", "/api/cargas", "/api/usuarios/abc"]) expect(puedeAcceder(r, "BIENESTAR")).toBe(false);
  });

  it("el administrador entra a todo y los dos roles empiezan en /inicio", () => {
    for (const r of ["/inicio", "/cargar", "/usuarios", "/api/cargas", "/agente"]) expect(puedeAcceder(r, "ADMIN")).toBe(true);
    expect(rutaInicial("ADMIN")).toBe("/inicio");
    expect(rutaInicial("BIENESTAR")).toBe("/inicio");
  });

  it("un prefijo parecido no hereda el permiso (/cargarx no es /cargar)", () => {
    expect(puedeAcceder("/cargarx", "BIENESTAR")).toBe(true); // sin regla: solo exige sesión
    expect(puedeAcceder("/cargar/historial", "BIENESTAR")).toBe(false);
  });
});
