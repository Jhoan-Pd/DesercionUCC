import { datosActuales, type RegistroEstudiante } from "./caracteristicas";
import { ModeloRiesgo, type Factor, type Prediccion } from "./ModeloRiesgo";
import modeloExportado from "../../ml/modelo_riesgo.json";

/** Modelo entrenado en Python que viene con el código (se usa si la BD no tiene un modelo activo) */
export const MODELO_BASE = modeloExportado as { definicion: unknown; metricas: Record<string, unknown> };

export interface PuntajeCalculado {
  estudianteId: string;
  prediccion: Prediccion;
}

/** Calcula la predicción de cada estudiante con su semestre más reciente */
export function puntuarRegistros(modelo: ModeloRiesgo, registros: RegistroEstudiante[]): PuntajeCalculado[] {
  const salida: PuntajeCalculado[] = [];
  for (const r of registros) {
    const datos = datosActuales(r);
    if (datos) salida.push({ estudianteId: r.id, prediccion: modelo.predecir(datos) });
  }
  return salida;
}

/** Factores en formato compacto para guardar en la columna JSON de puntajes_riesgo */
export function factoresParaGuardar(p: Prediccion): Factor[] {
  return p.factores.map((f) => ({
    ...f,
    valor: Math.round(f.valor * 1000) / 1000,
    promedio: Math.round(f.promedio * 1000) / 1000,
    aporte: Math.round(f.aporte * 10000) / 10000,
  }));
}

/** Texto de la alerta automática del modelo */
export function motivoAlertaModelo(p: Prediccion): string {
  const factores = ModeloRiesgo.principalesRiesgos(p, 3).map((f) => ModeloRiesgo.describir(f).split(" (")[0]);
  const detalle = factores.length ? ` Principales factores: ${factores.join("; ")}.` : "";
  return `Puntaje de riesgo ALTO (${p.puntaje}/100) según el modelo de alerta temprana.${detalle}`;
}
