/**
 * Cálculos puros del dashboard institucional (sin BD): reciben filas ya cargadas y devuelven
 * estadísticas listas para graficar. Al ser puros se prueban fácilmente con Vitest.
 */
import type { ReferenciasSpadies } from "@/services/parametros/conversores";

export type EstadoEst = "ACTIVO" | "GRADUADO" | "DESERTOR" | "APLAZADO";
export type CategoriaCausaDash = "INDIVIDUAL" | "ACADEMICA" | "SOCIOECONOMICA" | "INSTITUCIONAL";

export interface EstudianteFila {
  id: string;
  programaId: string;
  cohorte: string; // "2021-1"
  cohorteAnio: number;
  indiceIngreso: number; // índice cronológico del periodo de ingreso
  estado: EstadoEst;
  semestreActual: number;
  municipioOrigen: string;
}

export interface RetiroFila {
  estudianteId: string;
  periodoId: string;
  semestreRetiro: number;
  causaNombre: string;
  categoria: CategoriaCausaDash;
}

export interface ConteoPorClave {
  clave: string | number;
  total: number;
}

const redondear = (x: number, dec = 1): number => {
  const f = Math.pow(10, dec);
  return Math.round(x * f) / f;
};
const pct = (parte: number, total: number): number => (total > 0 ? (parte / total) * 100 : 0);

// ---------------------------------------------------------------------
// Deserción por cohorte
// ---------------------------------------------------------------------
export interface FilaCohorte {
  cohorte: string;
  total: number;
  desertores: number;
  tasa: number;
  /** Semestres completos que ya se pueden observar para esta cohorte */
  semestresObservados: number;
  /** Deserción acumulada nacional con la misma antigüedad (null si aún no hay referencia) */
  referenciaNacional: number | null;
}

export function desercionPorCohorte(
  estudiantes: EstudianteFila[],
  indiceActual: number,
  spadies: ReferenciasSpadies,
): FilaCohorte[] {
  const grupos = new Map<string, { indice: number; total: number; desertores: number }>();
  for (const e of estudiantes) {
    const g = grupos.get(e.cohorte) ?? { indice: e.indiceIngreso, total: 0, desertores: 0 };
    g.total++;
    if (e.estado === "DESERTOR") g.desertores++;
    grupos.set(e.cohorte, g);
  }
  return [...grupos.entries()]
    .sort((a, b) => a[1].indice - b[1].indice)
    .map(([cohorte, g]) => {
      const observados = Math.max(0, Math.min(spadies.cohorte.length, indiceActual - g.indice));
      return {
        cohorte,
        total: g.total,
        desertores: g.desertores,
        tasa: redondear(pct(g.desertores, g.total)),
        semestresObservados: observados,
        referenciaNacional: observados >= 1 ? spadies.cohorte[observados - 1] : null,
      };
    });
}

// ---------------------------------------------------------------------
// Deserción por programa
// ---------------------------------------------------------------------
export interface FilaPrograma {
  programaId: string;
  programa: string;
  total: number;
  desertores: number;
  tasa: number;
}

export function desercionPorPrograma(estudiantes: EstudianteFila[], nombres: Map<string, string>): FilaPrograma[] {
  const grupos = new Map<string, { total: number; desertores: number }>();
  for (const e of estudiantes) {
    const g = grupos.get(e.programaId) ?? { total: 0, desertores: 0 };
    g.total++;
    if (e.estado === "DESERTOR") g.desertores++;
    grupos.set(e.programaId, g);
  }
  return [...grupos.entries()]
    .map(([programaId, g]) => ({
      programaId,
      programa: nombres.get(programaId) ?? "Sin programa",
      total: g.total,
      desertores: g.desertores,
      tasa: redondear(pct(g.desertores, g.total)),
    }))
    .sort((a, b) => b.tasa - a.tasa);
}

// ---------------------------------------------------------------------
// Deserción por semestre cursado (tasa de riesgo / "hazard")
// ---------------------------------------------------------------------
export interface FilaSemestre {
  semestre: number;
  matriculados: number;
  desertores: number;
  /** % de estudiantes matriculados en ese semestre que se retiraron en él */
  tasa: number;
}

export function desercionPorSemestre(
  matriculadosPorSemestre: ConteoPorClave[],
  retiros: RetiroFila[],
  maxSemestre = 12,
): FilaSemestre[] {
  const retirosPor = new Map<number, number>();
  for (const r of retiros) retirosPor.set(r.semestreRetiro, (retirosPor.get(r.semestreRetiro) ?? 0) + 1);
  const matPor = new Map(matriculadosPorSemestre.map((c) => [Number(c.clave), c.total]));
  const filas: FilaSemestre[] = [];
  for (let s = 1; s <= maxSemestre; s++) {
    const matriculados = matPor.get(s) ?? 0;
    if (matriculados === 0) continue;
    const desertores = retirosPor.get(s) ?? 0;
    filas.push({ semestre: s, matriculados, desertores, tasa: redondear(pct(desertores, matriculados)) });
  }
  return filas;
}

// ---------------------------------------------------------------------
// Deserción por periodo
// ---------------------------------------------------------------------
export interface PeriodoCerrado {
  id: string;
  codigo: string;
  indice: number;
}

export interface FilaPeriodo {
  periodo: string;
  matriculados: number;
  desertores: number;
  /** Tasa intersemestral: retiros del periodo / matriculados del periodo */
  tasa: number;
}

export function desercionPorPeriodo(
  periodosCerrados: PeriodoCerrado[],
  matriculadosPorPeriodo: ConteoPorClave[],
  retiros: RetiroFila[],
): FilaPeriodo[] {
  const matPor = new Map(matriculadosPorPeriodo.map((c) => [String(c.clave), c.total]));
  const retPor = new Map<string, number>();
  for (const r of retiros) retPor.set(r.periodoId, (retPor.get(r.periodoId) ?? 0) + 1);
  return [...periodosCerrados]
    .sort((a, b) => a.indice - b.indice)
    .map((p) => {
      const matriculados = matPor.get(p.id) ?? 0;
      const desertores = retPor.get(p.id) ?? 0;
      return { periodo: p.codigo, matriculados, desertores, tasa: redondear(pct(desertores, matriculados), 2) };
    })
    .filter((f) => f.matriculados > 0);
}

/** Tasa anual equivalente a partir de dos tasas semestrales consecutivas (en %) */
export function tasaAnualDesdeSemestrales(t1: number, t2: number): number {
  return redondear((1 - (1 - t1 / 100) * (1 - t2 / 100)) * 100, 2);
}

// ---------------------------------------------------------------------
// Curvas de supervivencia (Kaplan-Meier por semestre)
// ---------------------------------------------------------------------
/**
 * Por qué Kaplan-Meier: las cohortes recientes aún no terminan su trayectoria
 * (datos "censurados"). Calcular simplemente desertores/total las haría ver mejor de lo que
 * están. KM usa solo a quienes siguen "en observación" en cada semestre.
 *
 *  - Evento: el estudiante se retira en el semestre k.
 *  - Censura: sigue activo (se observa hasta el último semestre COMPLETO), está aplazado
 *    (hasta su último semestre cursado) o se graduó (sale del riesgo al graduarse).
 *  - h(k) = retiros en k / estudiantes en riesgo en k ;  S(k) = Π (1 - h(j)) , j ≤ k.
 */
export interface PuntoSupervivencia {
  semestre: number;
  /** Clave de la serie ("2019", "Todas", "Nacional") -> % que sigue en la institución (o null) */
  [serie: string]: number | null;
}

interface Salida {
  tiempo: number;
  evento: boolean;
}

function salidaDe(e: EstudianteFila, retiroPorEstudiante: Map<string, RetiroFila>): Salida | null {
  if (e.estado === "DESERTOR") {
    const r = retiroPorEstudiante.get(e.id);
    return r ? { tiempo: r.semestreRetiro, evento: true } : null;
  }
  if (e.estado === "ACTIVO") return e.semestreActual - 1 >= 1 ? { tiempo: e.semestreActual - 1, evento: false } : null;
  // GRADUADO o APLAZADO: último semestre cursado
  return { tiempo: e.semestreActual, evento: false };
}

function kaplanMeier(salidas: Salida[], maxSemestre: number, minEnRiesgo: number): (number | null)[] {
  const curva: (number | null)[] = [100];
  let supervivencia = 1;
  for (let j = 1; j <= maxSemestre; j++) {
    const enRiesgo = salidas.filter((s) => s.tiempo >= j).length;
    if (enRiesgo < minEnRiesgo) {
      curva.push(null);
      continue;
    }
    const eventos = salidas.filter((s) => s.tiempo === j && s.evento).length;
    supervivencia *= 1 - eventos / enRiesgo;
    curva.push(redondear(supervivencia * 100));
  }
  return curva;
}

export interface ResultadoSupervivencia {
  puntos: PuntoSupervivencia[];
  series: string[];
}

export function curvasSupervivencia(
  estudiantes: EstudianteFila[],
  retiros: RetiroFila[],
  spadies: ReferenciasSpadies,
  opciones: { maxSemestre?: number; minEnRiesgo?: number } = {},
): ResultadoSupervivencia {
  const maxSemestre = opciones.maxSemestre ?? 12;
  const minEnRiesgo = opciones.minEnRiesgo ?? 10;
  const retiroPor = new Map(retiros.map((r) => [r.estudianteId, r]));

  const porAnio = new Map<number, Salida[]>();
  const todas: Salida[] = [];
  for (const e of estudiantes) {
    const s = salidaDe(e, retiroPor);
    if (!s) continue;
    todas.push(s);
    const lista = porAnio.get(e.cohorteAnio) ?? [];
    lista.push(s);
    porAnio.set(e.cohorteAnio, lista);
  }

  const anios = [...porAnio.keys()].sort((a, b) => a - b);
  const curvas = new Map<string, (number | null)[]>();
  for (const anio of anios) curvas.set(String(anio), kaplanMeier(porAnio.get(anio)!, maxSemestre, minEnRiesgo));
  curvas.set("Todas", kaplanMeier(todas, maxSemestre, minEnRiesgo));

  const puntos: PuntoSupervivencia[] = [];
  for (let k = 0; k <= maxSemestre; k++) {
    const punto: PuntoSupervivencia = { semestre: k };
    for (const [serie, curva] of curvas) punto[serie] = curva[k] ?? null;
    punto["Nacional"] = k === 0 ? 100 : k <= spadies.cohorte.length ? redondear(100 - spadies.cohorte[k - 1]) : null;
    puntos.push(punto);
  }
  return { puntos, series: [...anios.map(String), "Todas", "Nacional"] };
}

// ---------------------------------------------------------------------
// Causas (clasificación MEN / SPADIES)
// ---------------------------------------------------------------------
export interface ResumenCausas {
  topCausas: { causa: string; categoria: CategoriaCausaDash; total: number; porcentaje: number }[];
  porCategoria: { categoria: CategoriaCausaDash; total: number; porcentaje: number; referenciaNacional: number }[];
}

export function resumenCausas(retiros: RetiroFila[], spadies: ReferenciasSpadies, top = 8): ResumenCausas {
  const total = retiros.length;
  const porCausa = new Map<string, { categoria: CategoriaCausaDash; total: number }>();
  const porCat = new Map<CategoriaCausaDash, number>();
  for (const r of retiros) {
    const c = porCausa.get(r.causaNombre) ?? { categoria: r.categoria, total: 0 };
    c.total++;
    porCausa.set(r.causaNombre, c);
    porCat.set(r.categoria, (porCat.get(r.categoria) ?? 0) + 1);
  }
  const categorias: CategoriaCausaDash[] = ["SOCIOECONOMICA", "ACADEMICA", "INDIVIDUAL", "INSTITUCIONAL"];
  return {
    topCausas: [...porCausa.entries()]
      .map(([causa, c]) => ({ causa, categoria: c.categoria, total: c.total, porcentaje: redondear(pct(c.total, total)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, top),
    porCategoria: categorias.map((categoria) => ({
      categoria,
      total: porCat.get(categoria) ?? 0,
      porcentaje: redondear(pct(porCat.get(categoria) ?? 0, total)),
      referenciaNacional: spadies.causas[categoria],
    })),
  };
}

// ---------------------------------------------------------------------
// Dimensión regional: municipio de origen
// ---------------------------------------------------------------------
export interface FilaMunicipio {
  municipio: string;
  total: number;
  desertores: number;
  tasa: number;
}

export function desercionPorMunicipio(estudiantes: EstudianteFila[], top = 10, minEstudiantes = 15): FilaMunicipio[] {
  const grupos = new Map<string, { total: number; desertores: number }>();
  for (const e of estudiantes) {
    const g = grupos.get(e.municipioOrigen) ?? { total: 0, desertores: 0 };
    g.total++;
    if (e.estado === "DESERTOR") g.desertores++;
    grupos.set(e.municipioOrigen, g);
  }
  return [...grupos.entries()]
    .filter(([, g]) => g.total >= minEstudiantes)
    .map(([municipio, g]) => ({ municipio, total: g.total, desertores: g.desertores, tasa: redondear(pct(g.desertores, g.total)) }))
    .sort((a, b) => b.desertores - a.desertores)
    .slice(0, top);
}

// ---------------------------------------------------------------------
// Indicadores clave
// ---------------------------------------------------------------------
export interface Kpis {
  total: number;
  activos: number;
  aplazados: number;
  graduados: number;
  desertores: number;
  /** Desertores / total de estudiantes que ingresaron */
  tasaAcumulada: number;
  /** Tasa intersemestral del último periodo cerrado */
  tasaUltimoPeriodo: number | null;
  ultimoPeriodo: string | null;
  /** Tasa anual equivalente (últimos dos periodos cerrados) */
  tasaAnual: number | null;
  referenciaAnualNacional: number;
  /** Diferencia en puntos porcentuales frente a la referencia nacional anual */
  brechaAnualVsNacional: number | null;
}

export function calcularKpis(estudiantes: EstudianteFila[], porPeriodo: FilaPeriodo[], spadies: ReferenciasSpadies): Kpis {
  const cuenta = (estado: EstadoEst) => estudiantes.filter((e) => e.estado === estado).length;
  const total = estudiantes.length;
  const desertores = cuenta("DESERTOR");
  const ultimos = porPeriodo.slice(-2);
  const tasaAnual = ultimos.length === 2 ? tasaAnualDesdeSemestrales(ultimos[0].tasa, ultimos[1].tasa) : null;
  const ultimo = porPeriodo[porPeriodo.length - 1];
  return {
    total,
    activos: cuenta("ACTIVO"),
    aplazados: cuenta("APLAZADO"),
    graduados: cuenta("GRADUADO"),
    desertores,
    tasaAcumulada: redondear(pct(desertores, total)),
    tasaUltimoPeriodo: ultimo ? ultimo.tasa : null,
    ultimoPeriodo: ultimo ? ultimo.periodo : null,
    tasaAnual,
    referenciaAnualNacional: spadies.desercionAnualUniversitaria,
    brechaAnualVsNacional: tasaAnual === null ? null : redondear(tasaAnual - spadies.desercionAnualUniversitaria, 2),
  };
}
