import { afterEach, describe, expect, it, vi } from "vitest";
import { DATOS_UCC, resumenUccPasto } from "@/lib/datos-abiertos";
import { construirDatosUcc, obtenerDatosUcc } from "@/lib/datos-abiertos-remotos";
import type { FilaMatriculaMen } from "@/lib/datos-abiertos-depuracion";

const fila = (p: Partial<FilaMatriculaMen>): FilaMatriculaMen => ({
  a_o: "2021",
  semestre: "1",
  c_digo_de_la_instituci_n: "1818",
  instituci_n_de_educaci_n_superior_ies: "UNIVERSIDAD COOPERATIVA DE COLOMBIA",
  c_digo_del_municipio_programa: "52001",
  municipio_de_oferta_del_programa: "Pasto",
  c_digo_snies_delprograma: "8923",
  programa_acad_mico: "DERECHO",
  n_cleo_b_sico_del_conocimiento_nbc: "DERECHO Y AFINES",
  id_g_nero: "1",
  id_nivel_formacion: "6",
  id_metodologia: "1",
  matriculados_2015: "213",
  ...p,
});

afterEach(() => vi.unstubAllGlobals());

describe("datos abiertos en vivo", () => {
  it("arma el mismo formato que el respaldo, con la matrícula depurada y solo Pasto en el detalle", () => {
    const crudas = [fila({}), fila({}), fila({ id_g_nero: "2", matriculados_2015: "239" }), fila({ c_digo_del_municipio_programa: "11001", municipio_de_oferta_del_programa: "Bogotá, D.C.", matriculados_2015: "500" })];
    const d = construirDatosUcc(DATOS_UCC, crudas, [], { matricula: "2026-10-01", programas: "2026-09-01" }, new Date("2026-11-03T12:00:00Z"));
    expect(d.duplicadas).toBe(1);
    expect(d.matriculaPasto).toHaveLength(2);
    expect(d.matriculaNacionalPorAnio).toEqual({ "2021": 952 });
    expect(d.matriculaPorCampus).toEqual([["Bogotá, D.C.", 500], ["Pasto", 452]]);
    expect(d.descargadoEn).toBe("2026-11-03");
    expect(d.fuentes.matricula).toMatchObject({ id: "5wck-szir", actualizado: "2026-10-01" });
    // La misma función que resume el respaldo sirve para los datos en vivo
    expect(resumenUccPasto(d).ultimo).toMatchObject({ anio: 2021, total: 452 });
  });

  it("si datos.gov.co no devuelve la UCC, es un error (no una página con ceros)", () => {
    expect(() => construirDatosUcc(DATOS_UCC, [], [], { matricula: "", programas: "" })).toThrow();
  });

  it("sin conexión con datos.gov.co usa el respaldo del repositorio e informa el motivo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    const r = await obtenerDatosUcc();
    expect(r.datos).toBe(DATOS_UCC);
    expect(r.origen).toMatchObject({ tipo: "respaldo" });
    expect(resumenUccPasto(r.datos).ultimo.total).toBe(2097);
  });
});
