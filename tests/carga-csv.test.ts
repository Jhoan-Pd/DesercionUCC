import { describe, expect, it } from "vitest";
import { campoCSV, claveTexto, detectarSeparador, normalizarEncabezado, parsearCSV } from "@/services/carga/csv";

describe("parsearCSV", () => {
  it("detecta punto y coma (Excel en español) y coma", () => {
    expect(detectarSeparador("codigo;nombres;apellidos")).toBe(";");
    expect(detectarSeparador("codigo,nombres,apellidos")).toBe(",");
    expect(detectarSeparador("codigo\tnombres")).toBe("\t");
    expect(detectarSeparador('"a;b",c,d')).toBe(",");
  });

  it("lee comillas, comillas escapadas y separadores dentro de comillas", () => {
    const t = parsearCSV('a;b;c\n1;"Pérez; Gómez";"dijo ""hola"""\n');
    expect(t.encabezados).toEqual(["a", "b", "c"]);
    expect(t.filas[0].valores).toEqual(["1", "Pérez; Gómez", 'dijo "hola"']);
  });

  it("quita el BOM, acepta finales de línea de Windows e ignora filas vacías", () => {
    const t = parsearCSV("﻿a,b\r\n1,2\r\n\r\n,\r\n3,4\r\n");
    expect(t.encabezados).toEqual(["a", "b"]);
    expect(t.filas.map((f) => f.valores)).toEqual([["1", "2"], ["3", "4"]]);
  });

  it("conserva el número de línea real (contando saltos dentro de comillas)", () => {
    const t = parsearCSV('a,b\n1,"línea\npartida"\n2,x\n');
    expect(t.filas.map((f) => f.linea)).toEqual([2, 4]);
    expect(t.filas[0].valores[1]).toBe("línea\npartida");
  });

  it("archivo vacío", () => {
    expect(parsearCSV("")).toEqual({ separador: ",", encabezados: [], filas: [] });
  });
});

describe("normalización", () => {
  it("encabezados sin tildes, mayúsculas ni espacios", () => {
    expect(normalizarEncabezado(" Edad Ingreso ")).toBe("edad_ingreso");
    expect(normalizarEncabezado("Código")).toBe("codigo");
    expect(normalizarEncabezado("% Financiación")).toBe("_financiacion");
    expect(normalizarEncabezado("causa-retiro")).toBe("causa_retiro");
  });

  it("claveTexto iguala textos con y sin tildes", () => {
    expect(claveTexto("Ingeniería de Sistemas")).toBe(claveTexto("INGENIERIA DE SISTEMAS"));
  });

  it("campoCSV agrega comillas solo cuando hace falta", () => {
    expect(campoCSV("Pasto")).toBe("Pasto");
    expect(campoCSV("Pérez; Gómez")).toBe('"Pérez; Gómez"');
    expect(campoCSV('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(campoCSV(3.5)).toBe("3.5");
  });
});
