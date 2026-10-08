/** Tipos de la calculadora de impacto individual (sin dependencias de BD ni de React) */

export type NivelAlternativo = "BACHILLER" | "TECNICO" | "TECNOLOGO";
export type TipoFinanciacion = "RECURSOS_PROPIOS" | "ICETEX" | "BECA" | "CREDITO_UCC";
export type TipoEscenario = "CONTINUAR" | "RETIRARSE" | "APLAZAR" | "NOCTURNA_VIRTUAL" | "APOYO_FINANCIERO";

/** Supuestos globales (vienen de la tabla parametros_economicos y los edita el ADMIN) */
export interface ParametrosCalculadora {
  mesesPorSemestre: number;
  mesesPagoAnio: number;
  /** Tasa de descuento real anual como fracción (0.07 = 7%) */
  tasaDescuento: number;
  crecimientoProfesional: number;
  crecimientoAlternativo: Record<NivelAlternativo, number>;
  salarioAlternativo: Record<NivelAlternativo, number>;
  aplazarSemestres: number;
  nocturnaFactorDuracion: number;
  /** Fracción de descuento (0.1 = 10%) */
  nocturnaDescuentoMatricula: number;
  nocturnaFactorIngreso: number;
  /** Fracción de la matrícula cubierta por el apoyo (0.5 = 50%) */
  apoyoPorcentaje: number;
  /** Horizontes de análisis en años */
  horizontes: number[];
}

export interface EntradaImpacto {
  programa: { nombre: string; duracionSemestres: number; valorSemestre: number };
  /** Semestres ya completados */
  semestresCursados: number;
  matriculaTotalPagada?: number;
  transporteMensual: number;
  materialesSemestre: number;
  sostenimientoMensual: number;
  financiacion: {
    tipo: TipoFinanciacion;
    /** 0-100: porción de la matrícula que cubre esta fuente */
    porcentajeFinanciado: number;
    saldoDeuda?: number;
    /** Tasa efectiva anual como fracción (0.11 = 11%) */
    tasaEA: number;
    plazoMeses: number;
  };
  salarioProfesionalMensual: number;
  nivelAlternativo: NivelAlternativo;
  ingresoMensualActual: number;
}

export interface DesgloseInversion {
  matricula: number;
  transporte: number;
  materiales: number;
  sostenimiento: number;
  total: number;
  /** Cuánto de la matrícula se pagó con deuda, beca y recursos propios */
  matriculaConDeuda: number;
  matriculaConBeca: number;
  matriculaConRecursosPropios: number;
  /** Lo que salió del bolsillo del estudiante/familia (total - beca - deuda) */
  aporteDirecto: number;
}

export interface ResultadoDeuda {
  tieneDeuda: boolean;
  saldo: number;
  tasaEA: number;
  plazoMeses: number;
  cuotaMensual: number;
  totalAPagar: number;
  totalIntereses: number;
  /** Cuota / ingreso mensual (en %), con el ingreso alternativo (sin título) */
  cuotaSobreIngresoSinTitulo: number;
  /** Cuota / ingreso mensual (en %), con el ingreso profesional (con título) */
  cuotaSobreIngresoConTitulo: number;
  /** Cuántos salarios mensuales (sin título) equivale el saldo */
  mesesDeSalarioSinTitulo: number;
}

export interface ResultadoHorizonte {
  anios: number;
  /** Sumas nominales (sin descontar) */
  ingresoProfesionalNominal: number;
  ingresoAlternativoNominal: number;
  diferenciaNominal: number;
  /** Valores presentes */
  vpnProfesional: number;
  vpnAlternativo: number;
  /** VPN de la diferencia de ingresos (graduarse - retirarse) */
  vpnDiferenciaIngresos: number;
  /** VPN de la diferencia restando además el costo de terminar la carrera */
  vpnDiferenciaNeta: number;
}

export interface ResultadoEscenario {
  tipo: TipoEscenario;
  etiqueta: string;
  descripcion: string;
  /** Costo de lo que falta para terminar (matrícula, materiales, transporte), nominal */
  costoRestante: number;
  /** Meses hasta obtener el título (null si no se gradúa) */
  mesesHastaTitulo: number | null;
  /** Valor presente neto (ingresos - costos) a cada horizonte */
  vpnNeto: Record<number, number>;
  /** Diferencia frente a retirarse (valor presente) a cada horizonte */
  ventajaVsRetiro: Record<number, number>;
  /** Años hasta que el escenario supera acumuladamente a retirarse (null si no ocurre en el horizonte máximo) */
  puntoEquilibrioAnios: number | null;
  advertencias: string[];
}

export interface PuntoSerie {
  anio: number;
  [escenario: string]: number;
}

export interface ResultadoImpacto {
  semestresRestantes: number;
  inversion: DesgloseInversion;
  deuda: ResultadoDeuda;
  costoOportunidad: {
    nivelAlternativo: NivelAlternativo;
    salarioProfesionalInicial: number;
    salarioAlternativoInicial: number;
    horizontes: ResultadoHorizonte[];
    puntoEquilibrioAnios: number | null;
  };
  escenarios: ResultadoEscenario[];
  /** Ventaja acumulada (VPN) de cada escenario frente a retirarse, por año — para graficar */
  serieVentaja: PuntoSerie[];
  conclusion: string;
  supuestos: ParametrosCalculadora;
}
