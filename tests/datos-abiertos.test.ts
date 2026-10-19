import { describe, expect, it } from "vitest";
import { DATOS_UCC, claveNombre, formatoTitulo, matriculaPorAnio, matriculaPorPrograma, resumenUccPasto, variacion } from "@/lib/datos-abiertos";
import { depurarMatricula, esUcc, programasActivosUccPasto, totalPorAnio, totalPorCampus, type FilaMatriculaMen, type FilaProgramaMen } from "@/lib/datos-abiertos-depuracion";

const fila = (p: Partial<FilaMatriculaMen>): FilaMatriculaMen => ({
  a_o: "2019",
  semestre: "1",
  c_digo_de_la_instituci_n: "1818",
  instituci_n_de_educaci_n_superior_ies: "UNIVERSIDAD COOPERATIVA DE COLOMBIA",
  c_digo_del_municipio_programa: "52001",
  municipio_de_oferta_del_programa: "PASTO",
  c_digo_snies_delprograma: "8923",
  programa_acad_mico: "DERECHO",
  n_cleo_b_sico_del_conocimiento_nbc: "DERECHO Y AFINES",
  id_g_nero: "1",
  id_nivel_formacion: "6",
  id_metodologia: "1",
  matriculados_2015: "252",
  ...p,
});

describe("Depuración de la matrícula del MEN", () => {
  it("elimina los registros repetidos de 2015-2019 (Derecho 2019: 252 + 274, no el doble)", () => {
    const crudas = [fila({}), fila({}), fila({ id_g_nero: "2", matriculados_2015: "274" }), fila({ id_g_nero: "2", matriculados_2015: "274" })];
    const r = depurarMatricula(crudas);
    expect(r.filas).toHaveLength(2);
    expect(r.duplicadas).toBe(2);
    expect(r.conflictos).toEqual([]);
    expect(totalPorAnio(r.filas)).toEqual({ "2019": 526 });
  });

  it("descarta otras instituciones aunque su nombre se parezca", () => {
    const r = depurarMatricula([fila({}), fila({ instituci_n_de_educaci_n_superior_ies: "UNIVERSIDAD COOPERATIVA DE COLOMBIA - SEDE X" }), fila({ instituci_n_de_educaci_n_superior_ies: "UNIVERSIDAD PEDAGOGICA Y TECNOLOGICA DE COLOMBIA" })]);
    expect(r.filas).toHaveLength(1);
    expect(esUcc(" universidad  cooperativa de colombia ")).toBe(true);
  });

  it("si dos copias no coinciden, conserva la mayor y lo reporta", () => {
    const r = depurarMatricula([fila({ matriculados_2015: "10" }), fila({ matriculados_2015: "12" })]);
    expect(r.filas[0].matriculados_2015).toBe("12");
    expect(r.conflictos).toHaveLength(1);
  });

  it("suma por campus usando el código DANE, no el nombre escrito", () => {
    const filas = [fila({ a_o: "2021" }), fila({ a_o: "2021", municipio_de_oferta_del_programa: "Pasto", id_g_nero: "2", matriculados_2015: "10" }), fila({ a_o: "2021", c_digo_del_municipio_programa: "11001", municipio_de_oferta_del_programa: "Bogotá, D.C.", matriculados_2015: "5" })];
    expect(totalPorCampus(filas, "2021")).toEqual([
      ["PASTO", 262],
      ["Bogotá, D.C.", 5],
    ]);
  });

  it("toma solo los programas ACTIVOS de la UCC en Pasto", () => {
    const base: FilaProgramaMen = {
      codigoinstitucion: "1818",
      nombreinstitucion: "UNIVERSIDAD COOPERATIVA DE COLOMBIA",
      codigomunicipioprograma: "52001",
      nombreestadoprograma: "Activo",
      nombretituloobtenido: "MEDICO",
      nombrenbc: "Medicina",
      nombrenivelformacion: "Universitaria",
      nombrenivelacademico: "Pregrado",
      cantidadcreditos: "260",
      cantidadperiodos: "12",
      nombretipoacreditacion: "Registro calificado",
    };
    const r = programasActivosUccPasto([base, { ...base, nombreestadoprograma: "Inactivo" }, { ...base, codigomunicipioprograma: "11001" }]);
    expect(r).toEqual([["1818", "MEDICO", "Medicina", "Universitaria", "Pregrado", 260, 12, "Registro calificado"]]);
  });
});

describe("Resumen de las cifras oficiales (datos reales incluidos en el repositorio)", () => {
  it("la matrícula de Pasto coincide con la del MEN una vez depurada", () => {
    const porAnio = matriculaPorAnio(DATOS_UCC.matriculaPasto);
    expect(porAnio.map((a) => [a.anio, a.total])).toEqual([
      [2015, 2088],
      [2016, 2117],
      [2017, 2250],
      [2018, 2166],
      [2019, 2104],
      [2020, 2086],
      [2021, 2097],
    ]);
    for (const a of porAnio) {
      expect(a.hombres + a.mujeres).toBe(a.total);
      expect(a.pregrado + a.posgrado).toBe(a.total);
    }
  });

  it("la suma de los campus es igual al total nacional del último año", () => {
    const suma = DATOS_UCC.matriculaPorCampus.reduce((s, [, n]) => s + n, 0);
    expect(suma).toBe(DATOS_UCC.matriculaNacionalPorAnio[DATOS_UCC.anioCampus]);
  });

  it("agrupa un programa con varios códigos SNIES y escrituras distintas", () => {
    const programas = matriculaPorPrograma(DATOS_UCC.matriculaPasto, 2021);
    const industrial = programas.find((p) => claveNombre(p.programa) === "INGENIERIA INDUSTRIAL");
    expect(industrial?.total).toBe(29 + 20 + 83 + 45);
    expect(programas.filter((p) => claveNombre(p.programa) === "ODONTOLOGIA")).toHaveLength(1);
    expect(programas[0].programa).toBe("Medicina");
    expect(programas.reduce((s, p) => s + p.total, 0)).toBe(2097);
  });

  it("resumen: Pasto es la 9.ª sede por matrícula y cita la fuente", () => {
    const r = resumenUccPasto();
    expect(r.posicionPasto).toBe(9);
    expect(r.ultimo.anio).toBe(2021);
    expect(r.fuentes.matricula.url).toContain("datos.gov.co");
    expect(r.programasActivos[0].nivelAcademico).toBe("Pregrado");
  });

  it("formato de nombres y variación", () => {
    expect(formatoTitulo("ESPECIALIZACIÓN EN DERECHO PROCESAL PENAL")).toBe("Especialización en Derecho Procesal Penal");
    expect(claveNombre("Odontología")).toBe(claveNombre("ODONTOLOGIA"));
    expect(variacion(100, 80)).toBeCloseTo(-0.2);
    expect(variacion(0, 5)).toBeNull();
  });
});
