import { describe, expect, it } from "vitest";
import { debeSembrar } from "../prisma/inicializar";

describe("inicialización en el despliegue", () => {
  it("siembra solo cuando la base está vacía", () => {
    expect(debeSembrar(0, undefined)).toBe(true);
    expect(debeSembrar(14, undefined)).toBe(false);
  });

  it("FORZAR_SEED=1 permite recargar a propósito", () => {
    expect(debeSembrar(14, "1")).toBe(true);
    expect(debeSembrar(14, "true")).toBe(false);
  });
});
