/**
 * Impacto INSTITUCIONAL y REGIONAL de la deserción (clase pura, sin BD).
 *
 * Dimensiones que cuantifica:
 *  - Institucional: matrícula que la UCC deja de recibir por los semestres que los desertores no cursaron,
 *    y su efecto en los indicadores de graduación y permanencia.
 *  - Académica: semestres cursados que no terminaron en un título.
 *  - Social/regional: ingresos de por vida (valor presente) que los municipios de origen dejan de
 *    generar porque sus jóvenes no se titularon. Este valor lo calcula CalculadoraImpacto por estudiante.
 *
 * Supuestos (para sustentar):
 *  1. Montos en pesos de hoy: se usa el valor ACTUAL del semestre de cada programa.
 *  2. Un desertor habría cursado los semestres que le faltaban del plan (duración - semestre de retiro).
 *  3. En la proyección, los estudiantes "rescatados" se gradúan en la misma proporción que los demás
 *     estudiantes de su cohorte que no desertaron.
 */

export interface DesertorInstitucional {
  programa: string;
  cohorteAnio: number;
  /** Año del periodo en que se retiró */
  anioRetiro: number;
  /** Índice cronológico del periodo de retiro (0 = 2018-1) */
  indiceRetiro: number;
  semestreRetiro: number;
  duracionSemestres: number;
  valorSemestre: number;
  municipio: string;
  departamento: string;
  /** Ingreso de por vida que deja de generar (VPN a 20 años, de CalculadoraImpacto) */
  perdidaIngresoVida: number;
}

export interface EstudianteCohorte {
  cohorteAnio: number;
  estado: "ACTIVO" | "GRADUADO" | "DESERTOR" | "APLAZADO";
  /** true si ya pasó el tiempo máximo esperado para graduarse (duración + 2 semestres) */
  plazoVencido: boolean;
}

export interface FilaMonto {
  clave: string;
  desertores: number;
  semestresNoCursados: number;
  ingresosNoPercibidos: number;
}

export interface FilaGraduacion {
  cohorte: number;
  estudiantes: number;
  graduados: number;
  desertores: number;
  /** Siguen activos o aplazados después del plazo esperado */
  rezagados: number;
  tasaGraduacion: number;
  tasaDesercion: number;
}

export interface FilaRegional {
  municipio: string;
  departamento: string;
  desertores: number;
  perdidaIngresoVida: number;
}

export interface LineaBase {
  /** Desertores en el último año académico cerrado (dos periodos) */
  desertoresAnuales: number;
  /** Matrícula futura que se pierde por los desertores de ese año */
  ingresosPerdidosAnuales: number;
  /** Ingreso de por vida que pierden los desertores de ese año (VP) */
  perdidaRegionalAnual: number;
  /** Tasa de deserción anual de la UCC (%) */
  tasaDesercionAnual: number;
  /** Indicadores de cohortes con plazo vencido (%) */
  tasaGraduacion: number;
  tasaDesercionCohorte: number;
  tasaRezago: number;
}

export interface Proyeccion {
  reduccionPct: number;
  estudiantesRetenidosAnio: number;
  ingresosRecuperadosAnio: number;
  ingresosRecuperados5Anios: number;
  perdidaRegionalEvitadaAnio: number;
  tasaDesercionAnualNueva: number;
  tasaGraduacionNueva: number;
  /** Puntos porcentuales que gana la tasa de graduación */
  gananciaGraduacion: number;
}

export interface ResumenInstitucional {
  desertores: number;
  semestresNoCursados: number;
  semestresCursadosSinTitulo: number;
  ingresosNoPercibidos: number;
  perdidaRegionalTotal: number;
  porPrograma: FilaMonto[];
  porAnioRetiro: FilaMonto[];
  graduacion: FilaGraduacion[];
  regional: FilaRegional[];
  departamentos: FilaRegional[];
  lineaBase: LineaBase;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : 0);

/** Semestres que un desertor dejó de cursar (no negativos) */
export function semestresNoCursados(d: Pick<DesertorInstitucional, "duracionSemestres" | "semestreRetiro">): number {
  return Math.max(0, d.duracionSemestres - d.semestreRetiro);
}

export class CalculadoraInstitucional {
  /**
   * @param indicesUltimoAnio índices de los dos últimos periodos cerrados (para la línea base anual)
   * @param tasaDesercionAnual tasa anual actual de la UCC en % (del dashboard)
   */
  constructor(
    private readonly indicesUltimoAnio: number[],
    private readonly tasaDesercionAnual: number,
  ) {}

  calcular(desertores: DesertorInstitucional[], estudiantes: EstudianteCohorte[]): ResumenInstitucional {
    const graduacion = this.graduacionPorCohorte(estudiantes);
    const vencidos = estudiantes.filter((e) => e.plazoVencido);
    const g = vencidos.filter((e) => e.estado === "GRADUADO").length;
    const dz = vencidos.filter((e) => e.estado === "DESERTOR").length;

    const delAnio = desertores.filter((d) => this.indicesUltimoAnio.includes(d.indiceRetiro));
    const lineaBase: LineaBase = {
      desertoresAnuales: delAnio.length,
      ingresosPerdidosAnuales: delAnio.reduce((s, d) => s + semestresNoCursados(d) * d.valorSemestre, 0),
      perdidaRegionalAnual: delAnio.reduce((s, d) => s + d.perdidaIngresoVida, 0),
      tasaDesercionAnual: this.tasaDesercionAnual,
      tasaGraduacion: r1(pct(g, vencidos.length)),
      tasaDesercionCohorte: r1(pct(dz, vencidos.length)),
      tasaRezago: r1(pct(vencidos.length - g - dz, vencidos.length)),
    };

    const regional = this.agrupar(desertores, (d) => d.municipio, (d) => d.departamento);
    return {
      desertores: desertores.length,
      semestresNoCursados: desertores.reduce((s, d) => s + semestresNoCursados(d), 0),
      semestresCursadosSinTitulo: desertores.reduce((s, d) => s + d.semestreRetiro, 0),
      ingresosNoPercibidos: desertores.reduce((s, d) => s + semestresNoCursados(d) * d.valorSemestre, 0),
      perdidaRegionalTotal: desertores.reduce((s, d) => s + d.perdidaIngresoVida, 0),
      porPrograma: this.montos(desertores, (d) => d.programa).sort((a, b) => b.ingresosNoPercibidos - a.ingresosNoPercibidos),
      porAnioRetiro: this.montos(desertores, (d) => String(d.anioRetiro)).sort((a, b) => a.clave.localeCompare(b.clave)),
      graduacion,
      regional: regional.sort((a, b) => b.perdidaIngresoVida - a.perdidaIngresoVida),
      departamentos: this.agrupar(desertores, (d) => d.departamento, (d) => d.departamento).sort((a, b) => b.perdidaIngresoVida - a.perdidaIngresoVida),
      lineaBase,
    };
  }

  /** Graduación, deserción y rezago por cohorte, solo con estudiantes cuyo plazo ya venció */
  graduacionPorCohorte(estudiantes: EstudianteCohorte[]): FilaGraduacion[] {
    const grupos = new Map<number, EstudianteCohorte[]>();
    for (const e of estudiantes.filter((x) => x.plazoVencido)) {
      grupos.set(e.cohorteAnio, [...(grupos.get(e.cohorteAnio) ?? []), e]);
    }
    return [...grupos.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([cohorte, lista]) => {
        const graduados = lista.filter((e) => e.estado === "GRADUADO").length;
        const desertores = lista.filter((e) => e.estado === "DESERTOR").length;
        return {
          cohorte,
          estudiantes: lista.length,
          graduados,
          desertores,
          rezagados: lista.length - graduados - desertores,
          tasaGraduacion: r1(pct(graduados, lista.length)),
          tasaDesercion: r1(pct(desertores, lista.length)),
        };
      });
  }

  /**
   * ¿Qué pasaría si la deserción bajara un X %? Función pura y barata: la página la recalcula
   * en el navegador al mover el control deslizante.
   */
  static proyectar(base: LineaBase, reduccionPct: number): Proyeccion {
    const x = Math.min(100, Math.max(0, reduccionPct)) / 100;
    // Los rescatados se gradúan como los no desertores de su cohorte: G / (G + rezago)
    const noDesertores = base.tasaGraduacion + base.tasaRezago;
    const fraccionGradua = noDesertores > 0 ? base.tasaGraduacion / noDesertores : 0;
    const ganancia = base.tasaDesercionCohorte * x * fraccionGradua;
    const ingresosAnio = base.ingresosPerdidosAnuales * x;
    return {
      reduccionPct: Math.round(x * 100),
      estudiantesRetenidosAnio: Math.round(base.desertoresAnuales * x),
      ingresosRecuperadosAnio: Math.round(ingresosAnio),
      ingresosRecuperados5Anios: Math.round(ingresosAnio * 5),
      perdidaRegionalEvitadaAnio: Math.round(base.perdidaRegionalAnual * x),
      tasaDesercionAnualNueva: r1(base.tasaDesercionAnual * (1 - x)),
      tasaGraduacionNueva: r1(base.tasaGraduacion + ganancia),
      gananciaGraduacion: r1(ganancia),
    };
  }

  private montos(desertores: DesertorInstitucional[], clave: (d: DesertorInstitucional) => string): FilaMonto[] {
    const mapa = new Map<string, FilaMonto>();
    for (const d of desertores) {
      const k = clave(d);
      const f = mapa.get(k) ?? { clave: k, desertores: 0, semestresNoCursados: 0, ingresosNoPercibidos: 0 };
      f.desertores++;
      f.semestresNoCursados += semestresNoCursados(d);
      f.ingresosNoPercibidos += semestresNoCursados(d) * d.valorSemestre;
      mapa.set(k, f);
    }
    return [...mapa.values()];
  }

  private agrupar(desertores: DesertorInstitucional[], clave: (d: DesertorInstitucional) => string, depto: (d: DesertorInstitucional) => string): FilaRegional[] {
    const mapa = new Map<string, FilaRegional>();
    for (const d of desertores) {
      const k = clave(d);
      const f = mapa.get(k) ?? { municipio: k, departamento: depto(d), desertores: 0, perdidaIngresoVida: 0 };
      f.desertores++;
      f.perdidaIngresoVida += d.perdidaIngresoVida;
      mapa.set(k, f);
    }
    return [...mapa.values()];
  }
}
