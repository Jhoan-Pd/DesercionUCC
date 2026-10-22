import { describe, expect, it } from "vitest";
import { claveNombre, formatoTitulo, normalizarValor, sinTildes, textoLimpio } from "@/lib/texto";

describe("utilidades de texto", () => {
  it("quita tildes, diéresis y la virgulilla sin tocar el resto", () => {
    expect(sinTildes("Ingeniería, pingüino, año")).toBe("Ingenieria, pinguino, ano");
  });

  it("normaliza valores de celda para compararlos", () => {
    expect(normalizarValor("  Sí ")).toBe("si");
  });

  it("la clave de nombre iguala mayúsculas, tildes y espacios", () => {
    expect(claveNombre("Ingeniería  de Sistemas ")).toBe(claveNombre("INGENIERIA DE SISTEMAS"));
  });

  it("formato de título con las palabras menores en minúscula", () => {
    expect(formatoTitulo("  INGENIERÍA   DE SOFTWARE ")).toBe("Ingeniería de Software");
    expect(formatoTitulo("LICENCIATURA EN EDUCACIÓN PARA LA PAZ")).toBe("Licenciatura en Educación para la Paz");
    expect(formatoTitulo("de la salle")).toBe("De la Salle");
  });
});

describe("textoLimpio", () => {
  it("deja el texto en una sola línea, sin caracteres de control ni espacios repetidos", () => {
    expect(textoLimpio("  Ana\tMaría\r\n  Paz\u0000 ")).toBe("Ana María Paz");
  });
});
