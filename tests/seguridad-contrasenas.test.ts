import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { COSTO_BCRYPT, HASH_FICTICIO, cifrarContrasena, huellaContrasena, verificarContrasena } from "@/lib/seguridad/contrasenas";

describe("verificarContrasena", () => {
  it("acepta la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await cifrarContrasena("Bienestar2026");
    expect(await verificarContrasena("Bienestar2026", hash)).toBe(true);
    expect(await verificarContrasena("otra-2026", hash)).toBe(false);
  });

  it("sin cuenta nunca acepta, ni siquiera si alguien adivinara la contraseña del hash ficticio", async () => {
    expect(await verificarContrasena("cualquiera-1", null)).toBe(false);
  });

  it("el hash ficticio tiene el mismo costo que los reales, así la respuesta tarda lo mismo", () => {
    expect(bcrypt.getRounds(HASH_FICTICIO)).toBe(COSTO_BCRYPT);
  });
});

describe("huellaContrasena", () => {
  it("es estable para el mismo hash y cambia cuando cambia la contraseña", async () => {
    const a = await cifrarContrasena("Primera2026");
    const b = await cifrarContrasena("Segunda2026");
    expect(huellaContrasena(a)).toBe(huellaContrasena(a));
    expect(huellaContrasena(a)).not.toBe(huellaContrasena(b));
    expect(huellaContrasena(a)).toMatch(/^[0-9a-f]{16}$/);
  });
});
