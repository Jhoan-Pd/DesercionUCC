import type { ParametrosCalculadora } from "@/services/impacto/tipos";

/** Valores por defecto: se usan solo si falta un parámetro en la BD (la BD manda) */
export const VALORES_POR_DEFECTO: Record<string, number> = {
  smmlv: 1_750_905,
  salario_bachiller_mensual: 1_750_905,
  salario_tecnico_mensual: 1_950_000,
  salario_tecnologo_mensual: 2_300_000,
  salario_profesional_mensual: 2_900_000,
  crecimiento_real_profesional: 5,
  crecimiento_real_tecnologo: 3,
  crecimiento_real_bachiller: 1.5,
  meses_pago_anio: 12,
  tasa_descuento: 7,
  transporte_mensual: 120_000,
  materiales_semestre: 350_000,
  sostenimiento_mensual: 650_000,
  meses_por_semestre: 6,
  tasa_icetex_ea: 11,
  tasa_credito_ucc_ea: 14,
  plazo_amortizacion_meses: 60,
  aplazar_semestres: 1,
  nocturna_factor_duracion: 1.25,
  nocturna_descuento_matricula: 10,
  nocturna_factor_ingreso: 0.9,
  apoyo_porcentaje_beca: 50,
};

export type MapaParametros = Record<string, number>;

/**
 * Convierte el mapa clave->valor de la BD en los supuestos tipados de la calculadora.
 * Los porcentajes se guardan como 7 (=7%) para que el ADMIN los edite cómodamente
 * y aquí se transforman a fracciones (0.07). Función pura: fácil de probar.
 */
export function construirParametrosCalculadora(mapa: MapaParametros): ParametrosCalculadora {
  const v = (clave: string): number => {
    const valor = mapa[clave];
    return typeof valor === "number" && Number.isFinite(valor) ? valor : VALORES_POR_DEFECTO[clave];
  };
  return {
    mesesPorSemestre: v("meses_por_semestre"),
    mesesPagoAnio: v("meses_pago_anio"),
    tasaDescuento: v("tasa_descuento") / 100,
    crecimientoProfesional: v("crecimiento_real_profesional") / 100,
    crecimientoAlternativo: {
      BACHILLER: v("crecimiento_real_bachiller") / 100,
      TECNICO: v("crecimiento_real_tecnologo") / 100,
      TECNOLOGO: v("crecimiento_real_tecnologo") / 100,
    },
    salarioAlternativo: {
      BACHILLER: v("salario_bachiller_mensual"),
      TECNICO: v("salario_tecnico_mensual"),
      TECNOLOGO: v("salario_tecnologo_mensual"),
    },
    aplazarSemestres: v("aplazar_semestres"),
    nocturnaFactorDuracion: v("nocturna_factor_duracion"),
    nocturnaDescuentoMatricula: v("nocturna_descuento_matricula") / 100,
    nocturnaFactorIngreso: v("nocturna_factor_ingreso"),
    apoyoPorcentaje: v("apoyo_porcentaje_beca") / 100,
    horizontes: [10, 20, 30],
  };
}

export interface ReferenciasSpadies {
  desercionAnualUniversitaria: number;
  desercionAnualTotal: number;
  /** Deserción acumulada por cohorte (%) en el semestre 1..10 (índice 0 = semestre 1) */
  cohorte: number[];
  causas: { SOCIOECONOMICA: number; ACADEMICA: number; INDIVIDUAL: number; INSTITUCIONAL: number };
}

export function construirReferenciasSpadies(mapa: MapaParametros): ReferenciasSpadies {
  const num = (clave: string, defecto: number) => (Number.isFinite(mapa[clave]) ? mapa[clave] : defecto);
  const cohorteDefecto = [9.7, 13.65, 17.6, 21.55, 25.5, 27.74, 29.98, 32.22, 34.46, 36.7];
  return {
    desercionAnualUniversitaria: num("spadies_desercion_anual_universitaria", 7.82),
    desercionAnualTotal: num("spadies_desercion_anual_total", 8.97),
    cohorte: cohorteDefecto.map((d, i) => num(`spadies_cohorte_sem${i + 1}`, d)),
    causas: {
      SOCIOECONOMICA: num("spadies_causa_socioeconomica", 40),
      ACADEMICA: num("spadies_causa_academica", 25),
      INDIVIDUAL: num("spadies_causa_individual", 25),
      INSTITUCIONAL: num("spadies_causa_institucional", 10),
    },
  };
}
