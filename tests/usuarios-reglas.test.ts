import { describe, expect, it } from "vitest";
import { validarCambio } from "@/services/usuarios/reglas";
import { actualizarUsuarioSchema, crearUsuarioSchema } from "@/lib/validators/usuarios";
import { esViolacionDeUnicidad } from "@/lib/errores";
import { COSTO_BCRYPT, cifrarContrasena } from "@/lib/seguridad/contrasenas";

const admin = { id: "a", rol: "ADMIN" as const, activo: true };

describe("reglas de cuentas", () => {
  it("nadie se desactiva ni se quita el rol de administrador a sí mismo", () => {
    expect(validarCambio({ actorId: "a", objetivo: admin, cambio: { activo: false }, adminsActivos: 3 })).toMatch(/propia cuenta/);
    expect(validarCambio({ actorId: "a", objetivo: admin, cambio: { rol: "BIENESTAR" }, adminsActivos: 3 })).toMatch(/quitarte/);
  });

  it("siempre queda al menos un administrador activo", () => {
    expect(validarCambio({ actorId: "b", objetivo: admin, cambio: { activo: false }, adminsActivos: 1 })).toMatch(/al menos un administrador/);
    expect(validarCambio({ actorId: "b", objetivo: admin, cambio: { activo: false }, adminsActivos: 2 })).toBeNull();
  });

  it("cambios normales sobre una cuenta de Bienestar están permitidos", () => {
    expect(validarCambio({ actorId: "a", objetivo: { id: "b", rol: "BIENESTAR", activo: true }, cambio: { activo: false }, adminsActivos: 1 })).toBeNull();
  });

  it("valida correo, rol y contraseña segura", () => {
    expect(crearUsuarioSchema.safeParse({ nombre: "Ana Ruiz", email: "ANA@ucc.edu.co ", rol: "BIENESTAR", password: "Bienestar2026" }).success).toBe(true);
    expect(crearUsuarioSchema.safeParse({ nombre: "Ana Ruiz", email: "ana@ucc.edu.co", rol: "DOCENTE", password: "Bienestar2026" }).success).toBe(false);
    expect(crearUsuarioSchema.safeParse({ nombre: "Ana Ruiz", email: "ana@ucc.edu.co", rol: "BIENESTAR", password: "corta" }).success).toBe(false);
    expect(actualizarUsuarioSchema.safeParse({}).success).toBe(false);
  });
});

describe("errores de la base de datos", () => {
  it("reconoce la violación de unicidad por su código, sin depender de la clase de Prisma", () => {
    expect(esViolacionDeUnicidad({ code: "P2002", meta: { target: ["email"] } })).toBe(true);
    expect(esViolacionDeUnicidad({ code: "P2025" })).toBe(false);
    expect(esViolacionDeUnicidad(new Error("otra cosa"))).toBe(false);
    expect(esViolacionDeUnicidad(null)).toBe(false);
  });

  it("las contraseñas se cifran con bcrypt y el costo acordado", async () => {
    const hash = await cifrarContrasena("Clave2026");
    expect(hash).toMatch(new RegExp(`^\\$2[aby]\\$${COSTO_BCRYPT}\\$`));
  });
});
