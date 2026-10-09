import { z } from "zod";
import { definicionDe, vectorizar, type DatosSemestre, type FormatoCaracteristica } from "./caracteristicas";

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

/** Estructura del JSON que exporta ml/entrenar_modelo.py (y el entrenador TS) */
export const definicionModeloSchema = z
  .object({
    version: z.string().min(1),
    origen: z.string().min(1),
    horizonteSemestres: z.number().int().positive(),
    caracteristicas: z.array(z.string()).min(1),
    medias: z.array(z.number()),
    desviaciones: z.array(z.number()),
    coeficientes: z.array(z.number()),
    intercepto: z.number(),
    tasaBase: z.number().min(0).max(1),
    umbrales: z.object({ medio: z.number().min(0).max(1), alto: z.number().min(0).max(1) }),
  })
  .refine((d) => d.medias.length === d.caracteristicas.length && d.desviaciones.length === d.caracteristicas.length && d.coeficientes.length === d.caracteristicas.length, {
    message: "Las listas de medias, desviaciones y coeficientes deben tener el mismo largo que las características",
  })
  .refine((d) => d.umbrales.medio < d.umbrales.alto, { message: "El umbral medio debe ser menor que el alto" });

export type DefinicionModelo = z.infer<typeof definicionModeloSchema>;

export interface Factor {
  clave: string;
  etiqueta: string;
  formato: FormatoCaracteristica;
  /** Valor del estudiante (en sus unidades) */
  valor: number;
  /** Valor promedio en los datos de entrenamiento */
  promedio: number;
  /** Aporte al log-odds frente a un estudiante promedio: >0 aumenta el riesgo */
  aporte: number;
}

export interface Prediccion {
  probabilidad: number;
  /** 0-100: probabilidad estimada de desertar en el próximo año académico */
  puntaje: number;
  nivel: NivelRiesgo;
  /** Probabilidad de un estudiante "promedio" (para comparar) */
  probabilidadPromedio: number;
  /** Factores ordenados por la magnitud de su aporte */
  factores: Factor[];
}

const sigmoide = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Modelo de riesgo de deserción: regresión logística sobre características estandarizadas.
 *
 *   z_i = (x_i - media_i) / desviación_i
 *   logit = intercepto + Σ coef_i · z_i        p = 1 / (1 + e^-logit)
 *
 * Explicabilidad: como las variables están centradas, un estudiante con valores promedio tiene
 * logit = intercepto. El aporte de cada factor es coef_i · z_i, es decir, cuánto lo aleja del
 * estudiante promedio. Suma de aportes + intercepto = logit (la explicación es EXACTA, no aproximada).
 */
export class ModeloRiesgo {
  readonly definicion: DefinicionModelo;

  constructor(definicion: unknown) {
    this.definicion = definicionModeloSchema.parse(definicion);
  }

  get version(): string {
    return this.definicion.version;
  }

  clasificar(probabilidad: number): NivelRiesgo {
    const { medio, alto } = this.definicion.umbrales;
    if (probabilidad >= alto) return "ALTO";
    if (probabilidad >= medio) return "MEDIO";
    return "BAJO";
  }

  predecirVector(x: number[]): Prediccion {
    const d = this.definicion;
    if (x.length !== d.caracteristicas.length) throw new Error("El vector no coincide con las características del modelo");
    let logit = d.intercepto;
    const factores: Factor[] = d.caracteristicas.map((clave, i) => {
      const z = d.desviaciones[i] > 0 ? (x[i] - d.medias[i]) / d.desviaciones[i] : 0;
      const aporte = d.coeficientes[i] * z;
      logit += aporte;
      const def = definicionDe(clave);
      return { clave, etiqueta: def.etiqueta, formato: def.formato, valor: x[i], promedio: d.medias[i], aporte };
    });
    const probabilidad = sigmoide(logit);
    return {
      probabilidad,
      puntaje: Math.round(probabilidad * 100),
      nivel: this.clasificar(probabilidad),
      probabilidadPromedio: sigmoide(d.intercepto),
      factores: factores.sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte)),
    };
  }

  predecir(datos: DatosSemestre): Prediccion {
    return this.predecirVector(vectorizar(datos, this.definicion.caracteristicas));
  }

  /** Los k factores que más AUMENTAN el riesgo (para listas y alertas) */
  static principalesRiesgos(p: Prediccion, k = 3): Factor[] {
    return p.factores.filter((f) => f.aporte > 0.05).slice(0, k);
  }

  /** Texto corto de un factor: "Promedio del semestre: 2,6 (promedio 3,5)" */
  /** Etiqueta breve con el valor del estudiante: "Tiene beca: no", "Promedio del semestre: 1,49" */
  static etiquetaCorta(f: Factor): string {
    if (f.formato === "binario") return `${f.etiqueta}: ${f.valor >= 0.5 ? "sí" : "no"}`;
    const d = ModeloRiesgo.describir(f);
    return d.replace(/ \(promedio [^)]*\)$/, "");
  }

  static describir(f: Factor): string {
    const fmt = (v: number) => {
      switch (f.formato) {
        case "nota":
          return v.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        case "pct":
          return `${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })}%`;
        case "binario":
          return v >= 0.5 ? "Sí" : "No";
        default:
          return v.toLocaleString("es-CO", { maximumFractionDigits: 1 });
      }
    };
    if (f.formato === "binario") return `${f.etiqueta}: ${fmt(f.valor)}`;
    return `${f.etiqueta}: ${fmt(f.valor)} (promedio ${fmt(f.promedio)})`;
  }
}
