import { z } from "zod";
import { EntrenadorLogistico } from "./EntrenadorLogistico";
import { calcularMetricas, esDePrueba } from "./metricas";
import type { FactorRiesgo, NivelRiesgo, ResultadoRiesgo } from "./factores";
import { CLAVES_VARIABLES, VARIABLES, tieneValor, type ClaveVariable, type DatosEstudiante } from "./variables";

/**
 * MODELO ESTADÍSTICO entrenado con estudiantes REALES de la UCC que ya tienen resultado conocido
 * (RETIRADO = 1, GRADUADO = 0). Regresión logística con regularización L2 (EntrenadorLogistico,
 * equivalente a scikit-learn). Solo se activa si hay suficientes datos y discrimina bien:
 *
 *  - al menos MINIMO_ENTRENAMIENTO estudiantes con resultado y MINIMO_POR_CLASE de cada clase;
 *  - se evalúa con el 20 % de los estudiantes que NO se usaron para ajustarlo (separación por código);
 *  - se activa solo si el AUC en esa prueba es ≥ AUC_MINIMO. Si no, se sigue usando el puntaje por factores.
 */
export const MINIMO_ENTRENAMIENTO = 200;
export const MINIMO_POR_CLASE = 30;
export const AUC_MINIMO = 0.7;
/** Una variable entra al modelo solo si la traen al menos el 80 % de los estudiantes con resultado */
export const COBERTURA_MINIMA = 0.8;

export interface RegistroConResultado {
  codigo: string;
  datos: DatosEstudiante;
  retirado: boolean;
}

export const definicionModeloSchema = z.object({
  version: z.string().min(1),
  variables: z.array(z.enum(CLAVES_VARIABLES)).min(1),
  medias: z.array(z.number()),
  desviaciones: z.array(z.number()),
  coeficientes: z.array(z.number()),
  intercepto: z.number(),
  tasaBase: z.number().min(0).max(1),
  umbrales: z.object({ medio: z.number(), alto: z.number() }),
});
export type DefinicionModelo = z.infer<typeof definicionModeloSchema>;

export interface MetricasEntrenamiento {
  estudiantes: number;
  retirados: number;
  estudiantesPrueba: number;
  retiradosPrueba: number;
  auc: number;
  brier: number;
  sensibilidadAlto: number;
  precisionAlto: number;
  convergio: boolean;
  variables: ClaveVariable[];
  entrenadoEn: string;
}

export type ResultadoEntrenamiento =
  | { estado: "INSUFICIENTE"; motivo: string; estudiantes: number; retirados: number }
  | { estado: "ENTRENADO"; activable: boolean; motivo: string; definicion: DefinicionModelo; metricas: MetricasEntrenamiento };

const sigmoide = (x: number) => 1 / (1 + Math.exp(-x));
const aNumero = (v: number | boolean) => (typeof v === "boolean" ? (v ? 1 : 0) : v);

/** Variables con suficiente cobertura y que no son constantes */
export function variablesUtilizables(registros: RegistroConResultado[]): ClaveVariable[] {
  return VARIABLES.map((v) => v.clave).filter((clave) => {
    const valores = registros.map((r) => r.datos[clave]).filter(tieneValor).map(aNumero);
    if (valores.length < registros.length * COBERTURA_MINIMA) return false;
    return new Set(valores).size > 1;
  });
}

/** Convierte los datos en el vector del modelo; un dato faltante toma la media (aporte 0) */
export function vectorizar(d: DatosEstudiante, variables: ClaveVariable[], medias: number[]): number[] {
  return variables.map((clave, i) => {
    const v = d[clave];
    return tieneValor(v) ? aNumero(v) : medias[i];
  });
}

function mediasDe(registros: RegistroConResultado[], variables: ClaveVariable[]): number[] {
  return variables.map((clave) => {
    const valores = registros.map((r) => r.datos[clave]).filter(tieneValor).map(aNumero);
    return valores.reduce((a, b) => a + b, 0) / Math.max(1, valores.length);
  });
}

function ajustar(registros: RegistroConResultado[], variables: ClaveVariable[], version: string) {
  const imputacion = mediasDe(registros, variables);
  const X = registros.map((r) => vectorizar(r.datos, variables, imputacion));
  const y: number[] = registros.map((r) => (r.retirado ? 1 : 0));
  const ajuste = new EntrenadorLogistico({ C: 1 }).ajustar(X, y);
  const tasaBase = y.reduce((a, b) => a + b, 0) / y.length;
  const definicion: DefinicionModelo = {
    version,
    variables,
    medias: ajuste.medias,
    desviaciones: ajuste.desviaciones,
    coeficientes: ajuste.coeficientes,
    intercepto: ajuste.intercepto,
    tasaBase,
    umbrales: EntrenadorLogistico.umbrales(tasaBase),
  };
  return { definicion, convergio: ajuste.convergio };
}

export function probabilidad(def: DefinicionModelo, d: DatosEstudiante): { p: number; aportes: number[]; x: number[] } {
  const x = vectorizar(d, def.variables, def.medias);
  let logit = def.intercepto;
  const aportes = x.map((v, i) => {
    const zi = def.desviaciones[i] > 0 ? (v - def.medias[i]) / def.desviaciones[i] : 0;
    const a = def.coeficientes[i] * zi;
    logit += a;
    return a;
  });
  return { p: sigmoide(logit), aportes, x };
}

export function entrenarModelo(registros: RegistroConResultado[], version: string, fecha = new Date()): ResultadoEntrenamiento {
  const retirados = registros.filter((r) => r.retirado).length;
  const graduados = registros.length - retirados;
  if (registros.length < MINIMO_ENTRENAMIENTO || retirados < MINIMO_POR_CLASE || graduados < MINIMO_POR_CLASE) {
    return {
      estado: "INSUFICIENTE",
      motivo: `Se necesitan al menos ${MINIMO_ENTRENAMIENTO} estudiantes con resultado conocido (${MINIMO_POR_CLASE} retirados y ${MINIMO_POR_CLASE} graduados); hay ${registros.length} (${retirados} retirados y ${graduados} graduados).`,
      estudiantes: registros.length,
      retirados,
    };
  }
  const variables = variablesUtilizables(registros);
  if (variables.length === 0) {
    return { estado: "INSUFICIENTE", motivo: "Ninguna variable viene en al menos el 80 % de los registros con resultado.", estudiantes: registros.length, retirados };
  }

  // Evaluación honesta: se ajusta con el 80 % y se mide con el 20 % restante (por código de estudiante)
  const prueba = registros.filter((r) => esDePrueba(r.codigo));
  const entrenamiento = registros.filter((r) => !esDePrueba(r.codigo));
  const eval_ = ajustar(entrenamiento, variables, `${version}-eval`);
  const yPrueba = prueba.map((r) => (r.retirado ? 1 : 0));
  const pPrueba = prueba.map((r) => probabilidad(eval_.definicion, r.datos).p);
  const m = calcularMetricas(pPrueba, yPrueba, eval_.definicion.umbrales.alto);

  // Modelo final con todos los datos
  const final = ajustar(registros, variables, version);
  const convergio = eval_.convergio && final.convergio;
  const metricas: MetricasEntrenamiento = {
    estudiantes: registros.length,
    retirados,
    estudiantesPrueba: prueba.length,
    retiradosPrueba: m.positivos,
    auc: m.auc,
    brier: m.brier,
    sensibilidadAlto: m.sensibilidadAlto,
    precisionAlto: m.precisionAlto,
    convergio,
    variables,
    entrenadoEn: fecha.toISOString(),
  };
  const aucTxt = Number.isFinite(m.auc) ? m.auc.toLocaleString("es-CO", { maximumFractionDigits: 3 }) : "sin calcular";
  let activable = true;
  let motivo = `El modelo distingue bien a quienes se retiraron (AUC ${aucTxt} con estudiantes que no usó para aprender).`;
  if (!convergio) {
    activable = false;
    motivo = "El entrenamiento no convergió; se mantiene el puntaje por factores.";
  } else if (!Number.isFinite(m.auc) || m.positivos < 10 || m.positivos === m.n) {
    activable = false;
    motivo = "La muestra de prueba no tiene suficientes retirados y graduados para evaluar el modelo; se mantiene el puntaje por factores.";
  } else if (m.auc < AUC_MINIMO) {
    activable = false;
    motivo = `El modelo no discrimina lo suficiente (AUC ${aucTxt} < ${AUC_MINIMO.toLocaleString("es-CO")}); se mantiene el puntaje por factores.`;
  }
  return { estado: "ENTRENADO", activable, motivo, definicion: final.definicion, metricas };
}

function nivelModelo(def: DefinicionModelo, p: number): NivelRiesgo {
  if (p >= def.umbrales.alto) return "ALTO";
  if (p >= def.umbrales.medio) return "MEDIO";
  return "BAJO";
}

/**
 * Riesgo con el modelo. El puntaje es la probabilidad estimada (0-100).
 * Los puntos de cada factor reparten el riesgo que el estudiante tiene POR ENCIMA de un estudiante
 * promedio de la UCC, en proporción a lo que cada dato aporta al modelo (así suman exactamente ese
 * exceso y no se "aplastan" cuando la probabilidad es muy alta). Si el riesgo está por debajo del
 * promedio, cada factor muestra cuánto subiría el riesgo frente al promedio en ese dato.
 */
export function predecirConModelo(def: DefinicionModelo, d: DatosEstudiante): ResultadoRiesgo {
  const { p, aportes } = probabilidad(def, d);
  const logit = Math.log(p / (1 - p));
  const pPromedio = sigmoide(def.intercepto);
  const faltantes = def.variables.filter((v) => !tieneValor(d[v]));
  const positivos = def.variables.map((v, i) => (tieneValor(d[v]) && aportes[i] > 0 ? aportes[i] : 0));
  const sumaPositivos = positivos.reduce((a, b) => a + b, 0);
  const exceso = p - pPromedio;

  const factores: FactorRiesgo[] = def.variables
    .map((clave, i): FactorRiesgo | null => {
      if (positivos[i] <= 0) return null;
      const puntos = Math.round(100 * (exceso > 0 ? (exceso * positivos[i]) / sumaPositivos : p - sigmoide(logit - aportes[i])));
      if (puntos < 1) return null;
      const valor = d[clave] as number | boolean;
      const def_ = VARIABLES.find((v) => v.clave === clave)!;
      const detalle =
        typeof valor === "boolean"
          ? `${def_.formato(valor)}; en la UCC lo tiene el ${Math.round(def.medias[i] * 100)} % de los estudiantes con resultado conocido.`
          : `${def_.formato(valor)} frente a ${def_.formato(def.medias[i])} en promedio en la UCC.`;
      return { clave, etiqueta: def_.etiqueta, puntos, detalle };
    })
    .filter((f): f is FactorRiesgo => f !== null)
    .sort((a, b) => b.puntos - a.puntos);
  return { puntaje: Math.round(p * 100), nivel: nivelModelo(def, p), metodo: "MODELO", modeloVersion: def.version, factores, faltantes };
}
