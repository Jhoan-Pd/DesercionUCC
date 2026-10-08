/** Métricas de evaluación del modelo de riesgo (funciones puras) */

export interface MetricasModelo {
  n: number;
  positivos: number;
  tasaBase: number;
  /** Área bajo la curva ROC: probabilidad de que un desertor reciba más puntaje que un no desertor */
  auc: number;
  /** Error cuadrático medio de la probabilidad (menor es mejor) */
  brier: number;
  logLoss: number;
  /** Desempeño al marcar como "alto" a quienes superan el umbral alto */
  umbralAlto: number;
  precisionAlto: number;
  sensibilidadAlto: number;
  matrizConfusion: { vp: number; fp: number; vn: number; fn: number };
  /** Calibración por deciles: probabilidad media predicha vs. tasa observada */
  calibracion: { decil: number; predicho: number; observado: number; n: number }[];
}

/** AUC por el estadístico de Mann-Whitney (maneja empates con rangos promedio) */
export function auc(probabilidades: number[], y: number[]): number {
  const pares = probabilidades.map((p, i) => ({ p, y: y[i] })).sort((a, b) => a.p - b.p);
  let i = 0;
  let sumaRangosPositivos = 0;
  while (i < pares.length) {
    let j = i;
    while (j + 1 < pares.length && pares[j + 1].p === pares[i].p) j++;
    const rangoPromedio = (i + j + 2) / 2; // rangos 1-indexados
    for (let k = i; k <= j; k++) if (pares[k].y === 1) sumaRangosPositivos += rangoPromedio;
    i = j + 1;
  }
  const nPos = y.filter((v) => v === 1).length;
  const nNeg = y.length - nPos;
  if (nPos === 0 || nNeg === 0) return NaN;
  return (sumaRangosPositivos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

export function calcularMetricas(probabilidades: number[], y: number[], umbralAlto: number): MetricasModelo {
  const n = y.length;
  const positivos = y.filter((v) => v === 1).length;
  let brier = 0;
  let logLoss = 0;
  let vp = 0;
  let fp = 0;
  let vn = 0;
  let fn = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.min(Math.max(probabilidades[i], 1e-15), 1 - 1e-15);
    brier += (p - y[i]) ** 2 / n;
    logLoss += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p)) / n;
    const alto = probabilidades[i] >= umbralAlto;
    if (alto && y[i] === 1) vp++;
    else if (alto) fp++;
    else if (y[i] === 1) fn++;
    else vn++;
  }
  const orden = probabilidades.map((p, i) => ({ p, y: y[i] })).sort((a, b) => a.p - b.p);
  const calibracion = [];
  for (let d = 0; d < 10; d++) {
    const grupo = orden.slice(Math.floor((d * n) / 10), Math.floor(((d + 1) * n) / 10));
    if (grupo.length === 0) continue;
    calibracion.push({
      decil: d + 1,
      predicho: grupo.reduce((a, g) => a + g.p, 0) / grupo.length,
      observado: grupo.reduce((a, g) => a + g.y, 0) / grupo.length,
      n: grupo.length,
    });
  }
  return {
    n,
    positivos,
    tasaBase: positivos / n,
    auc: auc(probabilidades, y),
    brier,
    logLoss,
    umbralAlto,
    precisionAlto: vp + fp > 0 ? vp / (vp + fp) : 0,
    sensibilidadAlto: vp + fn > 0 ? vp / (vp + fn) : 0,
    matrizConfusion: { vp, fp, vn, fn },
    calibracion,
  };
}

/**
 * División entrenamiento/prueba POR ESTUDIANTE (todas las filas de un estudiante van al mismo lado),
 * determinista a partir del identificador. Evita "fuga" de información entre semestres de una misma persona.
 */
export function esDePrueba(estudianteId: string, proporcion = 0.2): boolean {
  let h = 2166136261;
  for (let i = 0; i < estudianteId.length; i++) {
    h ^= estudianteId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 < proporcion;
}
