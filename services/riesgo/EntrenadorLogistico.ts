/**
 * Regresión logística con regularización L2, equivalente a
 *   sklearn.linear_model.LogisticRegression(penalty="l2", C=1.0) sobre datos con StandardScaler.
 *
 * Minimiza:  ½·‖w‖²  +  C · Σ [ -y·log(p) - (1-y)·log(1-p) ]      (el intercepto NO se penaliza)
 *
 * Se resuelve con el método de Newton-Raphson (IRLS): con ~20 variables la matriz hessiana es
 * pequeña y converge en pocas iteraciones con precisión de máquina. Permite REENTRENAR el modelo
 * con los datos de la UCC directamente en el servidor (sin Python en producción).
 */
export interface OpcionesEntrenamiento {
  C?: number;
  maxIteraciones?: number;
  tolerancia?: number;
}

export interface ResultadoAjuste {
  medias: number[];
  desviaciones: number[];
  coeficientes: number[];
  intercepto: number;
  iteraciones: number;
  convergio: boolean;
}

/** Media y desviación estándar poblacional (ddof = 0, igual que StandardScaler) */
export function estandarizar(X: number[][]): { medias: number[]; desviaciones: number[] } {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const medias = new Array(p).fill(0);
  const desviaciones = new Array(p).fill(0);
  for (const fila of X) for (let j = 0; j < p; j++) medias[j] += fila[j] / n;
  for (const fila of X) for (let j = 0; j < p; j++) desviaciones[j] += (fila[j] - medias[j]) ** 2 / n;
  for (let j = 0; j < p; j++) desviaciones[j] = Math.sqrt(desviaciones[j]);
  return { medias, desviaciones };
}

/** Resuelve A·x = b por eliminación gaussiana con pivoteo parcial (A pequeña y simétrica definida positiva) */
export function resolverSistema(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let f = col + 1; f < n; f++) if (Math.abs(M[f][col]) > Math.abs(M[piv][col])) piv = f;
    if (Math.abs(M[piv][col]) < 1e-14) throw new Error("Sistema singular: revisa variables constantes o duplicadas");
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let f = col + 1; f < n; f++) {
      const factor = M[f][col] / M[col][col];
      for (let k = col; k <= n; k++) M[f][k] -= factor * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let f = n - 1; f >= 0; f--) {
    let suma = M[f][n];
    for (let k = f + 1; k < n; k++) suma -= M[f][k] * x[k];
    x[f] = suma / M[f][f];
  }
  return x;
}

export class EntrenadorLogistico {
  private readonly C: number;
  private readonly maxIteraciones: number;
  private readonly tolerancia: number;

  constructor(opciones: OpcionesEntrenamiento = {}) {
    this.C = opciones.C ?? 1.0;
    this.maxIteraciones = opciones.maxIteraciones ?? 50;
    this.tolerancia = opciones.tolerancia ?? 1e-10;
  }

  ajustar(X: number[][], y: number[]): ResultadoAjuste {
    if (X.length === 0 || X.length !== y.length) throw new Error("Datos de entrenamiento vacíos o inconsistentes");
    const n = X.length;
    const p = X[0].length;
    const { medias, desviaciones } = estandarizar(X);
    // Matriz de diseño estandarizada con columna de 1 al inicio (intercepto)
    const Z = X.map((fila) => [1, ...fila.map((v, j) => (desviaciones[j] > 0 ? (v - medias[j]) / desviaciones[j] : 0))]);
    const d = p + 1;
    const beta = new Array(d).fill(0);
    let iteraciones = 0;
    let convergio = false;

    for (; iteraciones < this.maxIteraciones; iteraciones++) {
      const grad = new Array(d).fill(0);
      const H = Array.from({ length: d }, () => new Array(d).fill(0));
      for (let i = 0; i < n; i++) {
        const zi = Z[i];
        let eta = 0;
        for (let j = 0; j < d; j++) eta += beta[j] * zi[j];
        const pi = 1 / (1 + Math.exp(-eta));
        const r = this.C * (pi - y[i]);
        const w = this.C * pi * (1 - pi);
        for (let j = 0; j < d; j++) {
          grad[j] += r * zi[j];
          const wz = w * zi[j];
          for (let k = j; k < d; k++) H[j][k] += wz * zi[k];
        }
      }
      for (let j = 0; j < d; j++) for (let k = 0; k < j; k++) H[j][k] = H[k][j];
      // Penalización L2 (sin intercepto)
      for (let j = 1; j < d; j++) {
        grad[j] += beta[j];
        H[j][j] += 1;
      }
      const paso = resolverSistema(H, grad);
      let cambio = 0;
      for (let j = 0; j < d; j++) {
        beta[j] -= paso[j];
        cambio = Math.max(cambio, Math.abs(paso[j]));
      }
      if (cambio < this.tolerancia) {
        convergio = true;
        iteraciones++;
        break;
      }
    }
    return { medias, desviaciones, coeficientes: beta.slice(1), intercepto: beta[0], iteraciones, convergio };
  }

  /**
   * Umbrales de nivel (regla documentada): MEDIO desde la tasa base (riesgo mayor que el de un
   * estudiante típico) y ALTO desde 2,5 veces la tasa base.
   */
  static umbrales(tasaBase: number): { medio: number; alto: number } {
    const medio = Math.round(tasaBase * 100) / 100;
    const alto = Math.min(0.9, Math.round(tasaBase * 2.5 * 100) / 100);
    return { medio, alto: Math.max(alto, medio + 0.01) };
  }
}
