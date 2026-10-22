import { describe, expect, it } from "vitest";
import { formatoEntero, formatoFecha, formatoFechaHora, formatoFechaLarga, formatoNumero, formatoPorcentaje } from "@/lib/formato";

describe("formato en español de Colombia", () => {
  it("números con punto de miles y coma decimal", () => {
    expect(formatoNumero(38672)).toBe("38.672");
    expect(formatoNumero(3.4, { min: 1, max: 2 })).toBe("3,4");
    expect(formatoNumero(0.84213, { max: 3 })).toBe("0,842");
    expect(formatoEntero(1234.6)).toBe("1.235");
  });

  it("porcentajes desde una fracción, con signo opcional", () => {
    expect(formatoPorcentaje(0.2)).toBe("20 %");
    expect(formatoPorcentaje(0.004, { decimales: 1, signo: true })).toBe("+0,4 %");
    expect(formatoPorcentaje(-0.221, { decimales: 1, signo: true })).toBe("-22,1 %");
  });

  it("fechas en la hora de Colombia aunque el servidor esté en UTC", () => {
    // 2 a. m. UTC del 21 de octubre todavía es 20 de octubre en Bogotá (UTC-5)
    const d = "2026-10-21T02:00:00Z";
    expect(formatoFecha(d)).toBe("20/10/2026");
    expect(formatoFechaHora(d)).toContain("20/10/2026");
    expect(formatoFechaLarga(new Date(d))).toBe("20 de octubre de 2026");
  });

  it("reutiliza el formateador para las mismas opciones", () => {
    expect(formatoNumero(1, { max: 2 })).toBe(formatoNumero(1, { max: 2 }));
  });
});
