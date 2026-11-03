import { create } from "@bufbuild/protobuf";
import type { ResultadoRiesgo, MetodoRiesgo as Metodo } from "@/services/riesgo/factores";
import type { NivelRiesgo as Nivel } from "@/services/riesgo/niveles";
import type { DatosEstudiante as Datos } from "@/services/riesgo/variables";
import {
  DatosEstudianteSchema,
  EvaluarResponseSchema,
  MetodoRiesgo,
  NivelRiesgo,
  type DatosEstudiante,
  type EvaluarResponse,
} from "./gen/observatorio/riesgo/v1/motor_riesgo_pb";

/**
 * Traducción entre los mensajes Protobuf (contrato gRPC) y los tipos del dominio.
 * Funciones puras y en los dos sentidos: el servidor las usa para responder y el navegador para
 * enviar los datos del simulador. Los enums de Protobuf tienen un valor 0 «sin especificar»
 * que el dominio no tiene; aquí se decide qué significa en cada caso.
 */

const NIVEL_A_PROTO: Readonly<Record<Nivel, NivelRiesgo>> = { BAJO: NivelRiesgo.BAJO, MEDIO: NivelRiesgo.MEDIO, ALTO: NivelRiesgo.ALTO };
const METODO_A_PROTO: Readonly<Record<Metodo, MetodoRiesgo>> = { FACTORES: MetodoRiesgo.FACTORES, MODELO: MetodoRiesgo.MODELO };

export const nivelAProto = (n: Nivel): NivelRiesgo => NIVEL_A_PROTO[n];
export const metodoAProto = (m: Metodo): MetodoRiesgo => METODO_A_PROTO[m];

export function nivelDesdeProto(n: NivelRiesgo): Nivel | null {
  if (n === NivelRiesgo.ALTO) return "ALTO";
  if (n === NivelRiesgo.MEDIO) return "MEDIO";
  if (n === NivelRiesgo.BAJO) return "BAJO";
  return null;
}

export function metodoDesdeProto(m: MetodoRiesgo): Metodo | null {
  if (m === MetodoRiesgo.MODELO) return "MODELO";
  if (m === MetodoRiesgo.FACTORES) return "FACTORES";
  return null;
}

/** Niveles iguales o más graves que el mínimo pedido (UNSPECIFIED = desde MEDIO) */
export function nivelesDesde(minimo: NivelRiesgo): Nivel[] {
  const desde = minimo === NivelRiesgo.UNSPECIFIED ? NivelRiesgo.MEDIO : minimo;
  return (["ALTO", "MEDIO", "BAJO"] as const).filter((n) => NIVEL_A_PROTO[n] >= desde);
}

/** Proto → dominio. Un campo `optional` ausente queda en null (dato faltante), nunca en 0. */
export function datosDesdeProto(d: DatosEstudiante | undefined): Datos {
  return {
    semestre: d?.semestre ?? 0,
    promedio: d?.promedio ?? null,
    materiasPerdidas: d?.materiasPerdidas ?? null,
    asistencia: d?.asistencia ?? null,
    estrato: d?.estrato ?? null,
    trabaja: d?.trabaja ?? null,
    apoyoFinanciero: d?.apoyoFinanciero ?? null,
    moraMatricula: d?.moraMatricula ?? null,
    puntajeSaber11: d?.puntajeSaber11 ?? null,
    edad: d?.edad ?? null,
  };
}

/** Dominio → proto (lo usa el navegador para armar la petición del simulador) */
export function datosAProto(d: Datos): DatosEstudiante {
  const opcional = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
  return create(DatosEstudianteSchema, {
    semestre: d.semestre,
    promedio: opcional(d.promedio),
    materiasPerdidas: opcional(d.materiasPerdidas),
    asistencia: opcional(d.asistencia),
    estrato: opcional(d.estrato),
    trabaja: opcional(d.trabaja),
    apoyoFinanciero: opcional(d.apoyoFinanciero),
    moraMatricula: opcional(d.moraMatricula),
    puntajeSaber11: opcional(d.puntajeSaber11),
    edad: opcional(d.edad),
  });
}

export function resultadoAProto(r: ResultadoRiesgo): EvaluarResponse {
  return create(EvaluarResponseSchema, {
    puntaje: r.puntaje,
    nivel: nivelAProto(r.nivel),
    metodo: metodoAProto(r.metodo),
    versionModelo: r.modeloVersion ?? "",
    factores: r.factores.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, puntos: Math.round(f.puntos), detalle: f.detalle })),
    faltantes: r.faltantes,
  });
}
