import { CLAVE_INTENCION_RETIRO, DIMENSIONES, PREGUNTAS, RECURSOS, type Dimension, type Recurso } from "./preguntas";

export type NivelEncuesta = "BAJO" | "MEDIO" | "ALTO";

export interface ResultadoEncuesta {
  /** 0-100 (más alto = más riesgo) */
  puntaje: number;
  nivel: NivelEncuesta;
  puntajesDimension: Record<Dimension, number>;
  /** Dimensiones ordenadas de mayor a menor riesgo */
  dimensionesCriticas: Dimension[];
  /** Si respondió que ha pensado seriamente en retirarse */
  intencionRetiro: boolean;
  recursos: Recurso[];
}

/**
 * Convierte las respuestas Likert en un puntaje de riesgo por dimensión y global.
 *  - Cada respuesta se lleva a 0-1 de riesgo: (v-1)/4, o (5-v)/4 si la pregunta es "invertida".
 *  - Dimensión = promedio ponderado × 100.  Global = promedio ponderado de dimensiones.
 *  - Niveles: < 35 BAJO, 35-55 MEDIO, ≥ 55 ALTO.
 *  - Regla de seguridad: si declara intención de retiro (4 = de acuerdo => al menos MEDIO; 5 => ALTO).
 */
export class EvaluadorEncuesta {
  static readonly UMBRAL_MEDIO = 35;
  static readonly UMBRAL_ALTO = 55;
  static readonly UMBRAL_RECURSO = 40;

  static validar(respuestas: Record<string, number>): string[] {
    const errores: string[] = [];
    for (const p of PREGUNTAS) {
      const v = respuestas[p.clave];
      if (v === undefined) errores.push(`Falta responder: "${p.texto}"`);
      else if (!Number.isInteger(v) || v < 1 || v > 5) errores.push(`Respuesta inválida en "${p.texto}"`);
    }
    return errores;
  }

  static evaluar(respuestas: Record<string, number>): ResultadoEncuesta {
    const errores = EvaluadorEncuesta.validar(respuestas);
    if (errores.length) throw new Error(errores[0]);

    const dims = Object.keys(DIMENSIONES) as Dimension[];
    const puntajesDimension = {} as Record<Dimension, number>;
    for (const d of dims) {
      const preguntas = PREGUNTAS.filter((p) => p.dimension === d);
      const pesoTotal = preguntas.reduce((a, p) => a + p.peso, 0);
      const riesgo = preguntas.reduce((a, p) => {
        const v = respuestas[p.clave];
        const r = p.invertida ? (5 - v) / 4 : (v - 1) / 4;
        return a + r * p.peso;
      }, 0);
      puntajesDimension[d] = Math.round((riesgo / pesoTotal) * 100);
    }
    const puntaje = Math.round(dims.reduce((a, d) => a + puntajesDimension[d] * DIMENSIONES[d].peso, 0));

    let nivel: NivelEncuesta = puntaje >= EvaluadorEncuesta.UMBRAL_ALTO ? "ALTO" : puntaje >= EvaluadorEncuesta.UMBRAL_MEDIO ? "MEDIO" : "BAJO";
    const intencion = respuestas[CLAVE_INTENCION_RETIRO];
    if (intencion === 5) nivel = "ALTO";
    else if (intencion === 4 && nivel === "BAJO") nivel = "MEDIO";

    const dimensionesCriticas = [...dims].sort((a, b) => puntajesDimension[b] - puntajesDimension[a]);
    const conRiesgo = dimensionesCriticas.filter((d) => puntajesDimension[d] >= EvaluadorEncuesta.UMBRAL_RECURSO);
    // Siempre se sugiere al menos el recurso de la dimensión más crítica
    const dimsRecurso = conRiesgo.length ? conRiesgo : dimensionesCriticas.slice(0, 1);
    const recursos = dimsRecurso.flatMap((d) => RECURSOS.filter((r) => r.dimension === d));

    return { puntaje, nivel, puntajesDimension, dimensionesCriticas, intencionRetiro: intencion >= 4, recursos };
  }
}
