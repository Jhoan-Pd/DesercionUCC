import type { EntradaImpacto, ParametrosCalculadora } from "@/services/impacto/tipos";

export const PARAMETROS_PRUEBA: ParametrosCalculadora = {
  mesesPorSemestre: 6,
  mesesPagoAnio: 12,
  tasaDescuento: 0.07,
  crecimientoProfesional: 0.05,
  crecimientoAlternativo: { BACHILLER: 0.015, TECNICO: 0.03, TECNOLOGO: 0.03 },
  salarioAlternativo: { BACHILLER: 1_750_905, TECNICO: 1_950_000, TECNOLOGO: 2_300_000 },
  aplazarSemestres: 1,
  nocturnaFactorDuracion: 1.25,
  nocturnaDescuentoMatricula: 0.1,
  nocturnaFactorIngreso: 0.9,
  apoyoPorcentaje: 0.5,
  horizontes: [10, 20, 30],
};

export const ENTRADA_PRUEBA: EntradaImpacto = {
  programa: { nombre: "Ingeniería de Sistemas", duracionSemestres: 10, valorSemestre: 4_300_000 },
  semestresCursados: 4,
  transporteMensual: 120_000,
  materialesSemestre: 350_000,
  sostenimientoMensual: 650_000,
  financiacion: { tipo: "ICETEX", porcentajeFinanciado: 80, tasaEA: 0.11, plazoMeses: 60 },
  salarioProfesionalMensual: 3_200_000,
  nivelAlternativo: "BACHILLER",
  ingresoMensualActual: 0,
};
