import { describe, expect, it } from "vitest";
import { CORREO_ADMIN_POR_DEFECTO, cuentaInicial } from "../prisma/cuenta-inicial";

describe("cuenta del primer administrador", () => {
  it("no tiene contraseña por defecto: sin variable de entorno no se crea", () => {
    expect(() => cuentaInicial({})).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it("exige una contraseña de al menos 8 caracteres con letras y números", () => {
    expect(() => cuentaInicial({ SEED_ADMIN_PASSWORD: "corta1" })).toThrow();
    expect(() => cuentaInicial({ SEED_ADMIN_PASSWORD: "solamenteletras" })).toThrow();
    expect(cuentaInicial({ SEED_ADMIN_PASSWORD: "Pasto2026x" }).email).toBe(CORREO_ADMIN_POR_DEFECTO);
  });

  it("acepta SEED_DEMO_PASSWORD de los despliegues anteriores y un correo propio", () => {
    const c = cuentaInicial({ SEED_DEMO_PASSWORD: "Clave2026", SEED_ADMIN_EMAIL: " Jhoan.Paredes@CampusUCC.edu.co " });
    expect(c).toEqual({ email: "jhoan.paredes@campusucc.edu.co", password: "Clave2026" });
    expect(() => cuentaInicial({ SEED_ADMIN_PASSWORD: "Clave2026", SEED_ADMIN_EMAIL: "no-es-correo" })).toThrow();
  });
});
