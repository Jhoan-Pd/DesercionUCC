import type {
  DesgloseInversion,
  EntradaImpacto,
  ParametrosCalculadora,
  PuntoSerie,
  ResultadoDeuda,
  ResultadoEscenario,
  ResultadoHorizonte,
  ResultadoImpacto,
  TipoEscenario,
} from "./tipos";

/**
 * Descripción de un camino de vida para simularlo mes a mes.
 *
 *   [ aplazo ][        estudio restante        ][   vida laboral (con o sin título)   ]
 *    trabaja    ingreso reducido + costos        profesional o alternativo
 */
interface ConfigFlujo {
  /** Meses iniciales sin estudiar, trabajando al ingreso alternativo (escenario "aplazar") */
  mesesAplazo: number;
  /** Meses de estudio que faltan */
  mesesEstudio: number;
  /** Ingreso mensual mientras estudia */
  ingresoDuranteEstudio: number;
  /** Costo mensual incremental de estudiar (matrícula + materiales + transporte) */
  costoMensualEstudio: number;
  /** Si es false, el camino es "retirarse": ingreso alternativo toda la vida */
  seGradua: boolean;
}

/** Resultado de simular un camino: acumulados mensuales (nominales y a valor presente) */
interface Flujo {
  ingresoNominal: Float64Array;
  costoNominal: Float64Array;
  ingresoVP: Float64Array;
  costoVP: Float64Array;
  mesesTotales: number;
}

const ETIQUETAS: Record<TipoEscenario, { etiqueta: string; descripcion: string }> = {
  CONTINUAR: {
    etiqueta: "Continuar y graduarme",
    descripcion: "Terminas los semestres que faltan en el tiempo previsto y recibes el título.",
  },
  RETIRARSE: {
    etiqueta: "Retirarme",
    descripcion: "Dejas la carrera hoy y trabajas con el nivel educativo que tienes (sin título superior).",
  },
  APLAZAR: {
    etiqueta: "Aplazar un semestre",
    descripcion: "Pausas el estudio, trabajas ese tiempo y luego retomas y te graduas.",
  },
  NOCTURNA_VIRTUAL: {
    etiqueta: "Cambiar a jornada nocturna o virtual",
    descripcion: "Trabajas casi tiempo completo mientras estudias; la carrera dura más, pero no pierdes ingresos.",
  },
  APOYO_FINANCIERO: {
    etiqueta: "Pedir apoyo financiero",
    descripcion: "Una beca o subsidio cubre parte de la matrícula restante y sigues el plan normal.",
  },
};

/**
 * Calculadora del impacto económico individual de desertar.
 *
 * Es una clase PURA: no accede a la base de datos ni a la red. Recibe los supuestos
 * (salarios, tasas, escenarios) en el constructor y los datos del estudiante en `calcular`.
 * Eso la hace determinista y fácil de probar con Vitest.
 *
 * Simplificaciones documentadas (para sustentar):
 *  1. El sostenimiento (alimentación, vivienda) cuenta en "dinero invertido" pero NO en la
 *     comparación de escenarios: se paga igual estudiando o trabajando.
 *  2. Todo se expresa en pesos reales (sin inflación); el crecimiento del salario es real.
 *  3. La deuda existente se paga en cualquier escenario, por lo que no altera la ventaja
 *     relativa entre escenarios; se analiza aparte (carga sobre el ingreso).
 *  4. El valor presente descuenta cada mes con la tasa de descuento anual equivalente.
 */
export class CalculadoraImpacto {
  constructor(private readonly parametros: ParametrosCalculadora) {}

  // -------------------------------------------------------------------
  // API pública
  // -------------------------------------------------------------------

  calcular(entrada: EntradaImpacto): ResultadoImpacto {
    this.validar(entrada);
    const escenarios = this.compararEscenarios(entrada);
    const costoOportunidad = this.calcularCostoOportunidad(entrada);
    const semestresRestantes = entrada.programa.duracionSemestres - entrada.semestresCursados;

    return {
      semestresRestantes,
      inversion: this.calcularInversion(entrada),
      deuda: this.calcularDeuda(entrada),
      costoOportunidad,
      escenarios,
      serieVentaja: this.construirSerie(entrada),
      conclusion: this.redactarConclusion(entrada, costoOportunidad.horizontes, costoOportunidad.puntoEquilibrioAnios, semestresRestantes),
      supuestos: this.parametros,
    };
  }

  /** Dinero invertido hasta hoy: matrícula, transporte, materiales y sostenimiento */
  calcularInversion(entrada: EntradaImpacto): DesgloseInversion {
    const { mesesPorSemestre } = this.parametros;
    const n = entrada.semestresCursados;
    const matricula = entrada.matriculaTotalPagada ?? entrada.programa.valorSemestre * n;
    const transporte = entrada.transporteMensual * mesesPorSemestre * n;
    const materiales = entrada.materialesSemestre * n;
    const sostenimiento = entrada.sostenimientoMensual * mesesPorSemestre * n;
    const total = matricula + transporte + materiales + sostenimiento;

    const { tipo, porcentajeFinanciado } = entrada.financiacion;
    const parteFinanciada = (matricula * porcentajeFinanciado) / 100;
    const matriculaConDeuda = tipo === "ICETEX" || tipo === "CREDITO_UCC" ? parteFinanciada : 0;
    const matriculaConBeca = tipo === "BECA" ? parteFinanciada : 0;
    const matriculaConRecursosPropios = matricula - matriculaConDeuda - matriculaConBeca;

    return {
      matricula,
      transporte,
      materiales,
      sostenimiento,
      total,
      matriculaConDeuda,
      matriculaConBeca,
      matriculaConRecursosPropios,
      aporteDirecto: total - matriculaConDeuda - matriculaConBeca,
    };
  }

  /** Deuda pendiente y qué tan pesada es sin título vs con título */
  calcularDeuda(entrada: EntradaImpacto): ResultadoDeuda {
    const inversion = this.calcularInversion(entrada);
    const esDeuda = entrada.financiacion.tipo === "ICETEX" || entrada.financiacion.tipo === "CREDITO_UCC";
    const saldo = entrada.financiacion.saldoDeuda ?? (esDeuda ? inversion.matriculaConDeuda : 0);
    const { tasaEA, plazoMeses } = entrada.financiacion;
    const tieneDeuda = saldo > 0;

    const cuota = tieneDeuda ? CalculadoraImpacto.cuotaFrancesa(saldo, tasaEA, plazoMeses) : 0;
    const totalAPagar = cuota * plazoMeses;
    const ingresoSinTitulo = this.parametros.salarioAlternativo[entrada.nivelAlternativo];
    const ingresoConTitulo = entrada.salarioProfesionalMensual;

    return {
      tieneDeuda,
      saldo,
      tasaEA,
      plazoMeses,
      cuotaMensual: cuota,
      totalAPagar: tieneDeuda ? totalAPagar : 0,
      totalIntereses: tieneDeuda ? Math.max(0, totalAPagar - saldo) : 0,
      cuotaSobreIngresoSinTitulo: ingresoSinTitulo > 0 ? (cuota / ingresoSinTitulo) * 100 : 0,
      cuotaSobreIngresoConTitulo: ingresoConTitulo > 0 ? (cuota / ingresoConTitulo) * 100 : 0,
      mesesDeSalarioSinTitulo: ingresoSinTitulo > 0 ? saldo / ingresoSinTitulo : 0,
    };
  }

  /**
   * Costo de oportunidad: ingresos proyectados de graduarse vs. quedarse en el nivel alternativo,
   * a 10, 20 y 30 años, en valor presente neto.
   */
  calcularCostoOportunidad(entrada: EntradaImpacto): ResultadoImpacto["costoOportunidad"] {
    this.validar(entrada);
    const maxAnios = Math.max(...this.parametros.horizontes);
    const mesesTotales = maxAnios * 12;
    const continuar = this.simular(this.configuracion("CONTINUAR", entrada), entrada, mesesTotales);
    const retirarse = this.simular(this.configuracion("RETIRARSE", entrada), entrada, mesesTotales);

    const horizontes: ResultadoHorizonte[] = this.parametros.horizontes.map((anios) => {
      const i = anios * 12 - 1;
      const vpnProf = continuar.ingresoVP[i];
      const vpnAlt = retirarse.ingresoVP[i];
      return {
        anios,
        ingresoProfesionalNominal: continuar.ingresoNominal[i],
        ingresoAlternativoNominal: retirarse.ingresoNominal[i],
        diferenciaNominal: continuar.ingresoNominal[i] - retirarse.ingresoNominal[i],
        vpnProfesional: vpnProf,
        vpnAlternativo: vpnAlt,
        vpnDiferenciaIngresos: vpnProf - vpnAlt,
        vpnDiferenciaNeta: continuar.ingresoVP[i] - continuar.costoVP[i] - retirarse.ingresoVP[i] + retirarse.costoVP[i],
      };
    });

    return {
      nivelAlternativo: entrada.nivelAlternativo,
      salarioProfesionalInicial: entrada.salarioProfesionalMensual,
      salarioAlternativoInicial: this.parametros.salarioAlternativo[entrada.nivelAlternativo],
      horizontes,
      puntoEquilibrioAnios: this.puntoEquilibrio(continuar, retirarse),
    };
  }

  /** Compara los cinco escenarios usando "retirarse" como línea base */
  compararEscenarios(entrada: EntradaImpacto): ResultadoEscenario[] {
    this.validar(entrada);
    const maxAnios = Math.max(...this.parametros.horizontes);
    const mesesTotales = maxAnios * 12;
    const tipos: TipoEscenario[] = ["CONTINUAR", "APOYO_FINANCIERO", "NOCTURNA_VIRTUAL", "APLAZAR", "RETIRARSE"];
    const flujos = new Map<TipoEscenario, Flujo>();
    const configs = new Map<TipoEscenario, ConfigFlujo>();
    for (const tipo of tipos) {
      const cfg = this.configuracion(tipo, entrada);
      configs.set(tipo, cfg);
      flujos.set(tipo, this.simular(cfg, entrada, mesesTotales));
    }
    const base = flujos.get("RETIRARSE")!;
    const semestresRestantes = entrada.programa.duracionSemestres - entrada.semestresCursados;

    return tipos.map((tipo) => {
      const flujo = flujos.get(tipo)!;
      const cfg = configs.get(tipo)!;
      const vpnNeto: Record<number, number> = {};
      const ventaja: Record<number, number> = {};
      for (const h of this.parametros.horizontes) {
        const i = h * 12 - 1;
        vpnNeto[h] = flujo.ingresoVP[i] - flujo.costoVP[i];
        ventaja[h] = vpnNeto[h] - (base.ingresoVP[i] - base.costoVP[i]);
      }
      const costoRestante = flujo.costoNominal[mesesTotales - 1];
      return {
        tipo,
        ...ETIQUETAS[tipo],
        costoRestante,
        mesesHastaTitulo: cfg.seGradua ? Math.round(cfg.mesesAplazo + cfg.mesesEstudio) : null,
        vpnNeto,
        ventajaVsRetiro: ventaja,
        puntoEquilibrioAnios: tipo === "RETIRARSE" ? null : this.puntoEquilibrio(flujo, base),
        advertencias: this.advertencias(tipo, entrada, semestresRestantes),
      };
    });
  }

  /** Cuota mensual del sistema francés (cuota fija). Con tasa 0 o plazo 0 se maneja el caso límite. */
  static cuotaFrancesa(saldo: number, tasaEA: number, plazoMeses: number): number {
    if (saldo <= 0 || plazoMeses <= 0) return 0;
    const i = Math.pow(1 + tasaEA, 1 / 12) - 1; // tasa mensual equivalente
    if (i === 0) return saldo / plazoMeses;
    return (saldo * i) / (1 - Math.pow(1 + i, -plazoMeses));
  }

  // -------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------

  private validar(entrada: EntradaImpacto): void {
    if (entrada.programa.duracionSemestres <= 0) throw new Error("La duración del programa debe ser positiva");
    if (entrada.semestresCursados < 0 || entrada.semestresCursados > entrada.programa.duracionSemestres) {
      throw new Error("Los semestres cursados deben estar entre 0 y la duración del programa");
    }
    if (this.parametros.horizontes.length === 0) throw new Error("Debe haber al menos un horizonte de análisis");
  }

  /** Traduce un escenario a su camino de vida mes a mes */
  private configuracion(tipo: TipoEscenario, entrada: EntradaImpacto): ConfigFlujo {
    const p = this.parametros;
    const semRestantes = entrada.programa.duracionSemestres - entrada.semestresCursados;
    const matriculaRestante = entrada.programa.valorSemestre * semRestantes;
    const materialesRestantes = entrada.materialesSemestre * semRestantes;
    const mesesNormales = semRestantes * p.mesesPorSemestre;
    const salarioAlt = p.salarioAlternativo[entrada.nivelAlternativo];

    const costoMensual = (matricula: number, meses: number): number =>
      meses > 0 ? (matricula + materialesRestantes) / meses + entrada.transporteMensual : 0;

    switch (tipo) {
      case "RETIRARSE":
        return { mesesAplazo: 0, mesesEstudio: 0, ingresoDuranteEstudio: 0, costoMensualEstudio: 0, seGradua: false };
      case "CONTINUAR":
        return {
          mesesAplazo: 0,
          mesesEstudio: mesesNormales,
          ingresoDuranteEstudio: entrada.ingresoMensualActual,
          costoMensualEstudio: costoMensual(matriculaRestante, mesesNormales),
          seGradua: true,
        };
      case "APLAZAR":
        return {
          mesesAplazo: p.aplazarSemestres * p.mesesPorSemestre,
          mesesEstudio: mesesNormales,
          ingresoDuranteEstudio: entrada.ingresoMensualActual,
          costoMensualEstudio: costoMensual(matriculaRestante, mesesNormales),
          seGradua: true,
        };
      case "NOCTURNA_VIRTUAL": {
        const meses = mesesNormales * p.nocturnaFactorDuracion;
        return {
          mesesAplazo: 0,
          mesesEstudio: meses,
          ingresoDuranteEstudio: Math.max(entrada.ingresoMensualActual, salarioAlt * p.nocturnaFactorIngreso),
          costoMensualEstudio: costoMensual(matriculaRestante * (1 - p.nocturnaDescuentoMatricula), meses),
          seGradua: true,
        };
      }
      case "APOYO_FINANCIERO":
        return {
          mesesAplazo: 0,
          mesesEstudio: mesesNormales,
          ingresoDuranteEstudio: entrada.ingresoMensualActual,
          costoMensualEstudio: costoMensual(matriculaRestante * (1 - p.apoyoPorcentaje), mesesNormales),
          seGradua: true,
        };
    }
  }

  /** Simula mes a mes y acumula ingresos y costos (nominales y a valor presente) */
  private simular(cfg: ConfigFlujo, entrada: EntradaImpacto, mesesTotales: number): Flujo {
    const p = this.parametros;
    const factorPagos = p.mesesPagoAnio / 12; // 12 meses = 1.0; 14 meses (con primas) = 1.1667
    const salarioAlt = p.salarioAlternativo[entrada.nivelAlternativo];
    const gAlt = p.crecimientoAlternativo[entrada.nivelAlternativo];
    const gProf = p.crecimientoProfesional;
    const finEstudio = cfg.mesesAplazo + cfg.mesesEstudio;

    const ingresoNominal = new Float64Array(mesesTotales);
    const costoNominal = new Float64Array(mesesTotales);
    const ingresoVP = new Float64Array(mesesTotales);
    const costoVP = new Float64Array(mesesTotales);

    let accIngNom = 0;
    let accCostNom = 0;
    let accIngVP = 0;
    let accCostVP = 0;

    for (let m = 0; m < mesesTotales; m++) {
      const salarioAltMes = salarioAlt * Math.pow(1 + gAlt, Math.floor(m / 12));
      let ingreso: number;
      let costo = 0;

      if (m < cfg.mesesAplazo) {
        ingreso = salarioAltMes;
      } else if (m < finEstudio) {
        ingreso = cfg.ingresoDuranteEstudio;
        costo = cfg.costoMensualEstudio;
      } else if (cfg.seGradua) {
        ingreso = entrada.salarioProfesionalMensual * Math.pow(1 + gProf, Math.floor((m - finEstudio) / 12));
      } else {
        ingreso = salarioAltMes;
      }
      ingreso *= factorPagos;

      const descuento = Math.pow(1 + p.tasaDescuento, -(m + 1) / 12);
      accIngNom += ingreso;
      accCostNom += costo;
      accIngVP += ingreso * descuento;
      accCostVP += costo * descuento;
      ingresoNominal[m] = accIngNom;
      costoNominal[m] = accCostNom;
      ingresoVP[m] = accIngVP;
      costoVP[m] = accCostVP;
    }
    return { ingresoNominal, costoNominal, ingresoVP, costoVP, mesesTotales };
  }

  /**
   * Punto de equilibrio (en años): cuándo A recupera lo que invirtió frente a B.
   * - Si A nunca queda por debajo de B, no hay inversión que recuperar => 0.
   * - Si queda por debajo, es el primer mes en que vuelve a igualar o superar a B.
   * - Si no lo logra dentro del horizonte máximo => null.
   */
  private puntoEquilibrio(a: Flujo, b: Flujo): number | null {
    let estuvoPorDebajo = false;
    for (let m = 0; m < a.mesesTotales; m++) {
      const diferencia = a.ingresoVP[m] - a.costoVP[m] - (b.ingresoVP[m] - b.costoVP[m]);
      if (diferencia < -1e-6) estuvoPorDebajo = true;
      else if (estuvoPorDebajo) return Math.round(((m + 1) / 12) * 10) / 10;
    }
    return estuvoPorDebajo ? null : 0;
  }

  /** Serie anual de ventaja (VPN) frente a retirarse, por escenario, para graficar */
  private construirSerie(entrada: EntradaImpacto): PuntoSerie[] {
    const maxAnios = Math.max(...this.parametros.horizontes);
    const mesesTotales = maxAnios * 12;
    const tipos: TipoEscenario[] = ["CONTINUAR", "APOYO_FINANCIERO", "NOCTURNA_VIRTUAL", "APLAZAR"];
    const base = this.simular(this.configuracion("RETIRARSE", entrada), entrada, mesesTotales);
    const flujos = tipos.map((t) => ({ tipo: t, flujo: this.simular(this.configuracion(t, entrada), entrada, mesesTotales) }));

    const serie: PuntoSerie[] = [];
    for (let anio = 0; anio <= maxAnios; anio++) {
      const punto: PuntoSerie = { anio };
      for (const { tipo, flujo } of flujos) {
        if (anio === 0) {
          punto[tipo] = 0;
        } else {
          const i = anio * 12 - 1;
          punto[tipo] = flujo.ingresoVP[i] - flujo.costoVP[i] - (base.ingresoVP[i] - base.costoVP[i]);
        }
      }
      serie.push(punto);
    }
    return serie;
  }

  private advertencias(tipo: TipoEscenario, entrada: EntradaImpacto, semestresRestantes: number): string[] {
    const avisos: string[] = [];
    const tieneDeuda = entrada.financiacion.tipo === "ICETEX" || entrada.financiacion.tipo === "CREDITO_UCC" || (entrada.financiacion.saldoDeuda ?? 0) > 0;
    switch (tipo) {
      case "RETIRARSE":
        if (tieneDeuda) avisos.push("La deuda con el crédito educativo no se cancela al retirarse: debes pagarla con ingresos sin título superior.");
        avisos.push("Puedes reingresar más adelante; consulta con tu programa las condiciones de reintegro.");
        break;
      case "APLAZAR":
        avisos.push("Aplazar aumenta el riesgo de no regresar. Confirma plazos y condiciones de reintegro con la Secretaría Académica.");
        if (tieneDeuda) avisos.push("Revisa con el prestamista si el aplazamiento afecta tu crédito o periodo de gracia.");
        break;
      case "NOCTURNA_VIRTUAL":
        avisos.push("Supone que consigues un empleo de tiempo casi completo; no está garantizado.");
        avisos.push("Verifica que tu programa ofrezca esta modalidad o jornada y qué créditos se homologan.");
        avisos.push("Estudiar y trabajar a la vez exige buena organización; Bienestar ofrece acompañamiento.");
        break;
      case "APOYO_FINANCIERO":
        avisos.push("Depende de que se apruebe una beca, subsidio o condonación; infórmate en Bienestar y Financiera.");
        break;
      case "CONTINUAR":
        if (semestresRestantes === 0) avisos.push("Ya completaste todos los semestres del plan de estudios.");
        break;
    }
    return avisos;
  }

  private redactarConclusion(
    entrada: EntradaImpacto,
    horizontes: ResultadoHorizonte[],
    equilibrio: number | null,
    semestresRestantes: number,
  ): string {
    const moneda = (v: number) =>
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Math.round(v));
    const h20 = horizontes.find((h) => h.anios === 20) ?? horizontes[horizontes.length - 1];
    if (semestresRestantes === 0) {
      return "Ya completaste todos los semestres del plan de estudios: concluir los trámites de grado te permite acceder al ingreso profesional.";
    }
    const nivel = entrada.nivelAlternativo === "BACHILLER" ? "bachiller" : entrada.nivelAlternativo === "TECNICO" ? "técnico" : "tecnólogo";
    const inicio = `Si te retiras, a ${h20.anios} años dejarías de ganar en valor presente cerca de ${moneda(Math.max(0, h20.vpnDiferenciaNeta))} frente a graduarte (ya descontando lo que cuesta terminar tus ${semestresRestantes} semestres restantes y comparando con un ingreso de ${nivel}).`;
    if (h20.vpnDiferenciaNeta <= 0) {
      return `Con los supuestos actuales, terminar la carrera no supera económicamente a quedarte como ${nivel} en ${h20.anios} años. Revisa los supuestos y considera también beneficios no monetarios del título.`;
    }
    return equilibrio !== null ? `${inicio} La inversión de terminar se recupera aproximadamente en ${equilibrio.toLocaleString("es-CO")} años.` : inicio;
  }
}
