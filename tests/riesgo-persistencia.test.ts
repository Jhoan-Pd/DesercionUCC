import { describe, expect, it } from "vitest";
import { factoresDe, faltantesDe } from "@/services/riesgo/persistencia";
import { CLAVES_VARIABLES, VARIABLES, datosDe } from "@/services/riesgo/variables";

describe("variables del riesgo", () => {
  it("la lista sigue el orden de las claves y cada definición corresponde a su clave", () => {
    expect(VARIABLES.map((v) => v.clave)).toEqual([...CLAVES_VARIABLES]);
  });

  it("datosDe copia solo las variables del riesgo (sin nombre ni código)", () => {
    const fila = { codigo: "A1", nombre: "Ana", semestre: 2, promedio: 3.1, materiasPerdidas: null, asistencia: 90, estrato: 2, trabaja: false, apoyoFinanciero: true, moraMatricula: null, puntajeSaber11: 280, edad: 19 };
    const d = datosDe(fila);
    expect(Object.keys(d).sort()).toEqual([...CLAVES_VARIABLES].sort());
    expect(d).not.toHaveProperty("nombre");
    expect(d.promedio).toBe(3.1);
  });
});

describe("lectura de evaluaciones guardadas", () => {
  it("descarta factores que no tienen la forma esperada", () => {
    const ok = { clave: "promedio", etiqueta: "Promedio", puntos: 25, detalle: "Bajo" };
    expect(factoresDe([ok, { clave: "x" }, null, "texto"])).toEqual([ok]);
    expect(factoresDe({ no: "es una lista" })).toEqual([]);
  });

  it("solo acepta variables conocidas como faltantes", () => {
    expect(faltantesDe(["promedio", "inventada", "edad"])).toEqual(["promedio", "edad"]);
    expect(faltantesDe(null)).toEqual([]);
  });
});
