import { EntrenadorLogistico } from "./EntrenadorLogistico";
import { ModeloRiesgo, type DefinicionModelo } from "./ModeloRiesgo";
import { calcularMetricas, esDePrueba, type MetricasModelo } from "./metricas";
import {
  HORIZONTE_SEMESTRES,
  clavesCaracteristicas,
  construirPanel,
  programaMasFrecuente,
  vectorizar,
  type FilaPanel,
  type RegistroEstudiante,
} from "./caracteristicas";

export type Recomendacion = "ACTIVAR" | "REVISAR" | "NO_ACTIVAR";

export interface OpcionesReentrenamiento {
  /** Inverso de la regularización L2 (1 = valor por defecto de scikit-learn) */
  C?: number;
  /** Proporción de ESTUDIANTES reservados para la prueba */
  proporcionPrueba?: number;
  /** Nombre de la versión que se guardará */
  version: string;
  /** Fecha del entrenamiento (inyectable para que las pruebas sean deterministas) */
  fecha?: Date;
}

/** Métricas que se guardan junto a la versión (mismas claves que exporta ml/entrenar_modelo.py) */
export interface MetricasReentrenamiento extends MetricasModelo {
  aucEntrenamiento: number;
  nEntrenamiento: number;
  estudiantes: number;
  estudiantesPrueba: number;
  iteraciones: number;
  convergio: boolean;
  entrenadoEn: string;
  libreria: string;
  C: number;
}

export interface ComparacionModelos {
  versionActual: string;
  /** Versión final nueva y versión activa, evaluadas sobre EXACTAMENTE las mismas filas de prueba */
  auc: { nuevo: number; actual: number };
  brier: { nuevo: number; actual: number };
  sensibilidadAlto: { nuevo: number; actual: number };
  precisionAlto: { nuevo: number; actual: number };
}

export interface ResultadoReentrenamiento {
  definicion: DefinicionModelo;
  metricas: MetricasReentrenamiento;
  comparacion: ComparacionModelos | null;
  recomendacion: Recomendacion;
  motivo: string;
  /** Las variables con más peso en el modelo nuevo (para revisar que tengan sentido) */
  coeficientesPrincipales: { clave: string; etiqueta: string; coeficiente: number }[];
}

/** Mínimos para que la evaluación sea confiable */
const MIN_FILAS = 200;
const MIN_POSITIVOS_PRUEBA = 30;

/**
 * Reentrena el modelo de riesgo con los datos que hay en la base de datos, siguiendo EL MISMO
 * procedimiento que ml/entrenar_modelo.py:
 *
 *   1. Panel estudiante-semestre con las mismas características (caracteristicas.ts).
 *   2. Separación entrenamiento/prueba por ESTUDIANTE (no por fila), para que la evaluación sea honesta.
 *   3. Ajuste en entrenamiento, métricas en prueba (AUC, Brier, precisión y sensibilidad del nivel ALTO).
 *   4. Modelo final ajustado con TODOS los datos: es el que se guarda para producción.
 *   5. Comparación simétrica con el modelo activo (versión final contra versión final) sobre las mismas filas.
 *
 * Clase pura: no toca la base de datos, por eso se prueba con Vitest sin servidor.
 */
export class Reentrenador {
  private readonly C: number;
  private readonly proporcionPrueba: number;

  constructor(private readonly opciones: OpcionesReentrenamiento) {
    this.C = opciones.C ?? 1;
    this.proporcionPrueba = opciones.proporcionPrueba ?? 0.2;
    if (!(this.C > 0)) throw new Error("C debe ser mayor que 0");
    if (!(this.proporcionPrueba > 0 && this.proporcionPrueba < 0.5)) throw new Error("La proporción de prueba debe estar entre 0 y 0,5");
  }

  entrenar(registros: RegistroEstudiante[], modeloActual: ModeloRiesgo | null): ResultadoReentrenamiento {
    const panel = construirPanel(registros);
    if (panel.length < MIN_FILAS) {
      throw new Error(`Hay muy pocos datos para entrenar (${panel.length} filas; se necesitan al menos ${MIN_FILAS}).`);
    }
    const referencia = programaMasFrecuente(registros);
    const claves = clavesCaracteristicas(registros.map((r) => r.programa), referencia);

    const entrenamiento: FilaPanel[] = [];
    const prueba: FilaPanel[] = [];
    for (const fila of panel) (esDePrueba(fila.estudianteId, this.proporcionPrueba) ? prueba : entrenamiento).push(fila);

    const yPrueba = prueba.map((f) => f.y);
    const positivosPrueba = yPrueba.filter((v) => v === 1).length;
    if (positivosPrueba === 0 || positivosPrueba === prueba.length) {
      throw new Error("El conjunto de prueba no tiene desertores y no desertores a la vez; no se puede evaluar.");
    }

    const entrenador = new EntrenadorLogistico({ C: this.C });

    // (3) Ajuste en entrenamiento y evaluación en prueba
    const Xent = entrenamiento.map((f) => vectorizar(f.datos, claves));
    const yEnt = entrenamiento.map((f) => f.y);
    const ajusteEval = entrenador.ajustar(Xent, yEnt);
    const modeloEval = new ModeloRiesgo(
      EntrenadorLogistico.definicion(ajusteEval, claves, yEnt, { version: `${this.opciones.version}-eval`, origen: "ENTRENAMIENTO_ADMIN", horizonteSemestres: HORIZONTE_SEMESTRES }),
    );
    const umbralAlto = modeloEval.definicion.umbrales.alto;
    const pPrueba = prueba.map((f) => modeloEval.predecir(f.datos).probabilidad);
    const pEnt = entrenamiento.map((f) => modeloEval.predecir(f.datos).probabilidad);
    const metricasPrueba = calcularMetricas(pPrueba, yPrueba, umbralAlto);
    const metricasEnt = calcularMetricas(pEnt, yEnt, umbralAlto);

    // (4) Modelo final con todos los datos
    const X = panel.map((f) => vectorizar(f.datos, claves));
    const y = panel.map((f) => f.y);
    const ajusteFinal = entrenador.ajustar(X, y);
    const definicion = EntrenadorLogistico.definicion(ajusteFinal, claves, y, {
      version: this.opciones.version,
      origen: "ENTRENAMIENTO_ADMIN",
      horizonteSemestres: HORIZONTE_SEMESTRES,
    });
    const modeloFinal = new ModeloRiesgo(definicion); // valida la estructura con Zod

    // (5) Comparación SIMÉTRICA con el modelo activo: los dos se entrenaron con todos los datos disponibles
    //     en su momento, así que se comparan sus versiones finales sobre las mismas filas de prueba y cada uno
    //     con su propio umbral. (Comparar el modelo de evaluación, que no vio esas filas, contra el activo, que
    //     sí las vio, castigaría injustamente al nuevo.) El AUC honesto fuera de muestra se reporta en `metricas`.
    let comparacion: ComparacionModelos | null = null;
    if (modeloActual) {
      const mNuevo = calcularMetricas(prueba.map((f) => modeloFinal.predecir(f.datos).probabilidad), yPrueba, modeloFinal.definicion.umbrales.alto);
      const mActual = calcularMetricas(prueba.map((f) => modeloActual.predecir(f.datos).probabilidad), yPrueba, modeloActual.definicion.umbrales.alto);
      comparacion = {
        versionActual: modeloActual.version,
        auc: { nuevo: mNuevo.auc, actual: mActual.auc },
        brier: { nuevo: mNuevo.brier, actual: mActual.brier },
        sensibilidadAlto: { nuevo: mNuevo.sensibilidadAlto, actual: mActual.sensibilidadAlto },
        precisionAlto: { nuevo: mNuevo.precisionAlto, actual: mActual.precisionAlto },
      };
    }

    const convergio = ajusteEval.convergio && ajusteFinal.convergio;
    const metricas: MetricasReentrenamiento = {
      ...metricasPrueba,
      aucEntrenamiento: metricasEnt.auc,
      nEntrenamiento: entrenamiento.length,
      estudiantes: new Set(panel.map((f) => f.estudianteId)).size,
      estudiantesPrueba: new Set(prueba.map((f) => f.estudianteId)).size,
      iteraciones: ajusteFinal.iteraciones,
      convergio,
      entrenadoEn: (this.opciones.fecha ?? new Date()).toISOString(),
      libreria: "TypeScript (Newton-Raphson, equivalente a scikit-learn)",
      C: this.C,
    };

    const { recomendacion, motivo } = Reentrenador.recomendar(metricas, comparacion, positivosPrueba);
    return {
      definicion: modeloFinal.definicion,
      metricas,
      comparacion,
      recomendacion,
      motivo,
      coeficientesPrincipales: Reentrenador.coeficientesPrincipales(modeloFinal, 8),
    };
  }

  /**
   * Regla de recomendación (documentada para la sustentación):
   *  - NO_ACTIVAR si no convergió o si el AUC baja más de 0,02 frente al modelo activo.
   *  - REVISAR si hay pocos desertores en la prueba o si el AUC baja entre 0,005 y 0,02.
   *  - ACTIVAR si el AUC se mantiene o mejora (pérdida menor a 0,005) y el Brier no empeora más de 5 %.
   */
  static recomendar(m: MetricasReentrenamiento, c: ComparacionModelos | null, positivosPrueba: number): { recomendacion: Recomendacion; motivo: string } {
    const dec = (x: number, d = 3) => x.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
    if (!m.convergio) return { recomendacion: "NO_ACTIVAR", motivo: "El entrenamiento no convergió; revisa los datos antes de usar esta versión." };
    if (positivosPrueba < MIN_POSITIVOS_PRUEBA) {
      return { recomendacion: "REVISAR", motivo: `Solo hay ${positivosPrueba} desertores en la prueba: la evaluación es poco confiable.` };
    }
    if (!c) return { recomendacion: "ACTIVAR", motivo: `No hay un modelo activo para comparar. AUC en prueba: ${dec(m.auc)}.` };
    const deltaAuc = c.auc.nuevo - c.auc.actual;
    const brierEmpeora = c.brier.nuevo > c.brier.actual * 1.05;
    const texto = `AUC ${dec(c.auc.nuevo)} frente a ${dec(c.auc.actual)} del modelo activo (${deltaAuc >= 0 ? "+" : ""}${dec(deltaAuc)}).`;
    if (deltaAuc < -0.02) return { recomendacion: "NO_ACTIVAR", motivo: `Discrimina peor que el modelo activo. ${texto}` };
    if (deltaAuc < -0.005 || brierEmpeora) {
      return { recomendacion: "REVISAR", motivo: `Desempeño ligeramente inferior${brierEmpeora ? " (peor calibración)" : ""}. ${texto}` };
    }
    return { recomendacion: "ACTIVAR", motivo: `Igual o mejor que el modelo activo. ${texto}` };
  }

  static coeficientesPrincipales(modelo: ModeloRiesgo, k: number) {
    const d = modelo.definicion;
    const factores = modelo.predecirVector(d.medias).factores; // solo para obtener etiquetas
    const etiqueta = new Map(factores.map((f) => [f.clave, f.etiqueta]));
    return d.caracteristicas
      .map((clave, i) => ({ clave, etiqueta: etiqueta.get(clave) ?? clave, coeficiente: d.coeficientes[i] }))
      .sort((a, b) => Math.abs(b.coeficiente) - Math.abs(a.coeficiente))
      .slice(0, k);
  }

  /** Nombre de versión legible en hora de Colombia: admin-20261015-1432 */
  static nombreVersion(fecha: Date): string {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(fecha);
    const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
    return `admin-${v("year")}${v("month")}${v("day")}-${v("hour")}${v("minute")}${v("second")}`;
  }
}
