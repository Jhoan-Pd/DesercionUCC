import { describe, expect, it } from "vitest";
import { codigoPeriodo, indicePeriodo, validarCambioUsuario, validarContrasena, validarFechasPeriodo } from "@/services/admin/reglas";

describe("periodos", () => {
  it("el índice es cronológico y coincide con el seed (2018-1 = 0, 2026-2 = 17)", () => {
    expect(indicePeriodo(2018, 1)).toBe(0);
    expect(indicePeriodo(2018, 2)).toBe(1);
    expect(indicePeriodo(2026, 2)).toBe(17);
    expect(indicePeriodo(2027, 1)).toBeGreaterThan(indicePeriodo(2026, 2));
    expect(codigoPeriodo(2027, 1)).toBe("2027-1");
  });

  it("valida las fechas", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    expect(validarFechasPeriodo(2027, d("2027-02-01"), d("2027-06-15"))).toBeNull();
    expect(validarFechasPeriodo(2027, d("2027-06-15"), d("2027-02-01"))).toMatch(/posterior/);
    expect(validarFechasPeriodo(2027, d("2026-12-01"), d("2027-04-01"))).toMatch(/año 2027/);
    expect(validarFechasPeriodo(2027, d("2027-02-01"), d("2027-02-20"))).toMatch(/entre 60 y 200 días/);
  });
});

describe("contraseñas", () => {
  it("exige 8 caracteres con letras y números", () => {
    expect(validarContrasena("corta1")).toMatch(/8 caracteres/);
    expect(validarContrasena("solamenteletras")).toMatch(/letras y números/);
    expect(validarContrasena("12345678")).toMatch(/letras y números/);
    expect(validarContrasena("Pasto2026")).toBeNull();
    expect(validarContrasena("ñandú2026")).toBeNull();
  });
});

describe("cambios de usuario", () => {
  const base = { esUnoMismo: false, rolActual: "BIENESTAR", activoActual: true, adminsActivos: 2 };

  it("nadie se desactiva ni se cambia el rol a sí mismo", () => {
    expect(validarCambioUsuario({ ...base, esUnoMismo: true, activoNuevo: false })).toMatch(/propia cuenta/);
    expect(validarCambioUsuario({ ...base, esUnoMismo: true, rolActual: "ADMIN", rolNuevo: "DOCENTE" })).toMatch(/propio rol/);
    expect(validarCambioUsuario({ ...base, esUnoMismo: true, rolNuevo: "BIENESTAR" })).toBeNull();
  });

  it("protege al último administrador activo", () => {
    expect(validarCambioUsuario({ ...base, rolActual: "ADMIN", activoNuevo: false, adminsActivos: 1 })).toMatch(/al menos un administrador/);
    expect(validarCambioUsuario({ ...base, rolActual: "ADMIN", rolNuevo: "BIENESTAR", adminsActivos: 1 })).toMatch(/al menos un administrador/);
    expect(validarCambioUsuario({ ...base, rolActual: "ADMIN", activoNuevo: false, adminsActivos: 2 })).toBeNull();
  });

  it("cambios normales permitidos", () => {
    expect(validarCambioUsuario({ ...base, rolNuevo: "DOCENTE" })).toBeNull();
    expect(validarCambioUsuario({ ...base, activoNuevo: false })).toBeNull();
    // Reactivar a un admin inactivo nunca reduce los administradores
    expect(validarCambioUsuario({ ...base, rolActual: "ADMIN", activoActual: false, activoNuevo: true, adminsActivos: 1 })).toBeNull();
  });
});
