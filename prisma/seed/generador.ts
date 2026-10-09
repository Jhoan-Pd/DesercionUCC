/**
 * Generador de datos SINTÉTICOS del Observatorio de Deserción UCC.
 *
 * Los datos reales de estudiantes son privados (Ley 1581 de 2012), por lo que este
 * módulo simula trayectorias académicas realistas. La deserción NO se asigna al azar:
 * se simula semestre a semestre con un modelo de riesgo (logit) que depende de variables
 * conocidas en la literatura (SPADIES): estrato, trabajo, promedio, materias perdidas,
 * financiación, semestre cursado y programa. Así el modelo de Fase 2 puede "redescubrir"
 * esas relaciones, y los dashboards muestran patrones creíbles.
 *
 * Es una función PURA (no toca la BD) y determinista: misma semilla => mismo dataset.
 */
import { createHash, randomUUID } from "node:crypto";
import { fakerES } from "@faker-js/faker";
import type {
  CategoriaCausa,
  EstadoEstudiante,
  Sexo,
  TipoFinanciacion,
  TipoIntervencion,
} from "@prisma/client";
import { Aleatorio, acotar, sigmoide } from "./aleatorio";
import {
  ANIO_COHORTE_FINAL,
  ANIO_INICIAL,
  CAUSAS,
  INDICE_PERIODO_ACTUAL,
  MUNICIPIOS,
  PARAMETROS_BASE,
  PERIODO_ACTUAL,
  PROGRAMAS,
  type CausaBase,
  type ProgramaBase,
} from "./constantes";

// ---------------------------------------------------------------------
// Tipos de salida (coinciden con los modelos de Prisma)
// ---------------------------------------------------------------------

export interface ProgramaSeed {
  id: string;
  nombre: string;
  facultad: string;
  duracionSemestres: number;
  valorSemestre: number;
}

export interface PeriodoSeed {
  id: string;
  codigo: string;
  anio: number;
  semestre: number;
  indice: number;
  fechaInicio: Date;
  fechaFin: Date;
  activo: boolean;
}

export interface CausaSeed {
  id: string;
  nombre: string;
  categoria: CategoriaCausa;
  descripcion: string;
}

export interface EstudianteSeed {
  id: string;
  codigo: string;
  hashAnonimo: string;
  nombres: string;
  apellidos: string;
  sexo: Sexo;
  edadIngreso: number;
  estrato: number;
  municipioOrigen: string;
  departamentoOrigen: string;
  trabaja: boolean;
  horasTrabajoSemana: number;
  programaId: string;
  periodoIngresoId: string;
  cohorte: string;
  cohorteAnio: number;
  semestreActual: number;
  estado: EstadoEstudiante;
  consentimientoDatos: boolean;
  fechaConsentimiento: Date;
}

export interface MatriculaSeed {
  id: string;
  estudianteId: string;
  periodoId: string;
  semestre: number;
  valorMatricula: number;
}

export interface NotaSeed {
  id: string;
  estudianteId: string;
  periodoId: string;
  semestre: number;
  promedio: number;
  materiasInscritas: number;
  materiasPerdidas: number;
  asistenciaPct: number;
}

export interface FinanciacionSeed {
  id: string;
  estudianteId: string;
  tipo: TipoFinanciacion;
  porcentajeCubierto: number;
  montoTotal: number;
  saldoPendiente: number;
  tasaEA: number;
  plazoMeses: number;
}

export interface RetiroSeed {
  id: string;
  estudianteId: string;
  periodoId: string;
  semestreRetiro: number;
  fechaRetiro: Date;
  causaId: string;
  observacion: string | null;
}

export interface ParametroSeed {
  categoria: "SALARIO" | "COSTO" | "FINANCIERO" | "ESCENARIO" | "SPADIES";
  clave: string;
  nombre: string;
  valor: number;
  unidad: string;
  descripcion: string | null;
  fuente: string | null;
  programaId: string | null;
}

/** Intervención histórica de Bienestar (el responsable se asigna en el seed) */
export interface IntervencionSeed {
  id: string;
  estudianteId: string;
  periodoId: string;
  tipo: TipoIntervencion;
  fecha: Date;
  descripcion: string;
  montoApoyo: number | null;
  resultado: string;
}

export interface DatasetSintetico {
  programas: ProgramaSeed[];
  periodos: PeriodoSeed[];
  causas: CausaSeed[];
  estudiantes: EstudianteSeed[];
  matriculas: MatriculaSeed[];
  notas: NotaSeed[];
  financiaciones: FinanciacionSeed[];
  retiros: RetiroSeed[];
  parametros: ParametroSeed[];
  intervenciones: IntervencionSeed[];
}

export interface OpcionesGenerador {
  totalEstudiantes?: number;
  semilla?: number;
}

// ---------------------------------------------------------------------
// Calibración del modelo de deserción simulado
// ---------------------------------------------------------------------

/**
 * Intercepto del logit de deserción por semestre. Se calibró para que la
 * deserción acumulada a 10 semestres quede cerca del 40% (la referencia nacional
 * SPADIES ronda 37% para educación superior en general).
 */
const INTERCEPTO_DESERCION = -4.05;

/** Efecto del número de semestre cursado sobre el riesgo (mayor al inicio) */
function efectoSemestre(k: number): number {
  const tabla: Record<number, number> = { 1: 0.7, 2: 0.55, 3: 0.35, 4: 0.15, 5: 0, 6: -0.2 };
  if (k in tabla) return tabla[k];
  return Math.max(-1.1, -0.2 - 0.25 * (k - 6));
}

interface PerfilEstudiante {
  habilidad: number; // latente ~ N(0,1)
  motivacion: number; // latente ~ N(0,1)
  estrato: number;
  trabaja: boolean;
  horas: number;
  edadIngreso: number;
  financiacion: TipoFinanciacion;
  programa: ProgramaBase;
}

interface ResultadoSemestre {
  promedio: number;
  materiasInscritas: number;
  materiasPerdidas: number;
  asistenciaPct: number;
}

function simularSemestre(r: Aleatorio, p: PerfilEstudiante, k: number, promedioPrevio: number | null): ResultadoSemestre {
  const cargaTrabajo = p.trabaja ? Math.min(p.horas, 48) / 40 : 0;
  const inercia = promedioPrevio === null ? 0 : 0.3 * (promedioPrevio - 3.5);
  const dificultad = p.programa.nombre === "Medicina" ? -0.1 : p.programa.nombre.startsWith("Ingeniería") ? -0.12 : 0;
  const base =
    3.55 + 0.4 * p.habilidad - 0.4 * cargaTrabajo + inercia + dificultad + (k === 1 ? -0.15 : 0) + r.normal(0, 0.32);
  const promedio = Math.round(acotar(base, 0.8, 4.9) * 100) / 100;

  const materiasInscritas = p.programa.nombre === "Medicina" ? r.entero(6, 8) : r.entero(5, 7);
  const pPerder = acotar(sigmoide(-2.1 * (promedio - 2.85)) * 0.9, 0.01, 0.85);
  let materiasPerdidas = 0;
  for (let i = 0; i < materiasInscritas; i++) if (r.bernoulli(pPerder)) materiasPerdidas++;

  const asistenciaPct = Math.round(acotar(88 + 4 * p.habilidad - 10 * cargaTrabajo - 1.5 * materiasPerdidas + r.normal(0, 5), 35, 100) * 10) / 10;
  return { promedio, materiasInscritas, materiasPerdidas, asistenciaPct };
}

function probabilidadDesercion(p: PerfilEstudiante, k: number, s: ResultadoSemestre): number {
  const cargaTrabajo = p.trabaja ? Math.min(p.horas, 48) / 40 : 0;
  let z = INTERCEPTO_DESERCION + p.programa.riesgoBase + efectoSemestre(k);
  z += p.estrato <= 2 ? 0.35 : p.estrato >= 4 ? -0.3 : 0;
  z += -0.9 * (s.promedio - 3.5);
  z += 0.22 * s.materiasPerdidas;
  z += -0.022 * (s.asistenciaPct - 85);
  z += 0.95 * cargaTrabajo;
  z += p.edadIngreso >= 22 ? 0.3 : 0;
  z += -0.4 * p.motivacion;
  switch (p.financiacion) {
    case "BECA":
      z -= 0.55;
      break;
    case "ICETEX":
      z -= 0.1;
      break;
    case "CREDITO_UCC":
      z += 0.05;
      break;
    case "RECURSOS_PROPIOS":
      z += p.estrato <= 3 ? 0.3 : 0.1;
      break;
  }
  return sigmoide(z);
}

function elegirCausa(r: Aleatorio, p: PerfilEstudiante, s: ResultadoSemestre, causas: CausaSeed[], base: CausaBase[]): CausaSeed {
  const cargaTrabajo = p.trabaja ? Math.min(p.horas, 48) / 40 : 0;
  const bajoRendimiento = s.promedio < 3.0 || s.materiasPerdidas >= 3;
  const vulnerable = p.estrato <= 2 && p.financiacion !== "BECA";
  const pesoCategoria: Record<CategoriaCausa, number> = {
    SOCIOECONOMICA: 0.3 + (vulnerable ? 0.28 : 0) + 0.3 * cargaTrabajo,
    ACADEMICA: 0.2 + (bajoRendimiento ? 0.45 : 0),
    INDIVIDUAL: 0.3 + (p.motivacion < -0.5 ? 0.15 : 0),
    INSTITUCIONAL: 0.1,
  };
  const categorias = Object.keys(pesoCategoria) as CategoriaCausa[];
  const categoria = r.ponderado(categorias, categorias.map((c) => pesoCategoria[c]));

  const candidatas = base.filter((c) => c.categoria === categoria);
  const pesos = candidatas.map((c) => {
    let w = c.peso;
    if (c.afinidad === "trabajo" && cargaTrabajo > 0.4) w *= 2;
    if (c.afinidad === "dinero" && vulnerable) w *= 1.6;
    if (c.afinidad === "rendimiento" && bajoRendimiento) w *= 1.6;
    if (c.afinidad === "vocacion" && p.motivacion < 0) w *= 1.5;
    return w;
  });
  const elegida = r.ponderado(candidatas, pesos);
  return causas.find((c) => c.nombre === elegida.nombre) as CausaSeed;
}

// ---------------------------------------------------------------------
// Intervenciones históricas de Bienestar (programa de acompañamiento desde 2021)
// ---------------------------------------------------------------------

/** Año en que arranca el programa de acompañamiento simulado */
export const ANIO_INICIO_INTERVENCIONES = 2021;
/** Solo se interviene a quien supera este riesgo semestral (el "en riesgo" que Bienestar detecta) */
const UMBRAL_RIESGO_INTERVENCION = 0.12;

/** Cobertura del programa: crece cada año a medida que Bienestar se fortalece */
function coberturaIntervencion(anio: number): number {
  return Math.min(0.6, 0.25 + 0.07 * (anio - ANIO_INICIO_INTERVENCIONES));
}

/**
 * Efecto VERDADERO de cada tipo de intervención en el simulador: cuánto reduce el logit del
 * riesgo de desertar ese semestre. El módulo de efectividad debe "redescubrir" estos efectos
 * a partir de los datos (con la limitación de que solo ve lo observable, como en la realidad).
 */
export const EFECTO_INTERVENCION: Record<TipoIntervencion, number> = {
  APOYO_ECONOMICO: 0.6,
  TUTORIA: 0.45,
  ACOMPANAMIENTO_PSICOLOGICO: 0.4,
  ORIENTACION_VOCACIONAL: 0.25,
  OTRO: 0.1,
};

/**
 * Bienestar elige el tipo según lo que más pesa en la situación del estudiante, con algo de
 * azar (no siempre hay cupo en tutorías, a veces el estudiante prefiere otra ayuda).
 */
function elegirTipoIntervencion(ri: Aleatorio, p: PerfilEstudiante, s: ResultadoSemestre, k: number): TipoIntervencion {
  const cargaTrabajo = p.trabaja ? Math.min(p.horas, 48) / 40 : 0;
  const vulnerable = p.estrato <= 2 && p.financiacion !== "BECA";
  const tipos: TipoIntervencion[] = ["TUTORIA", "APOYO_ECONOMICO", "ACOMPANAMIENTO_PSICOLOGICO", "ORIENTACION_VOCACIONAL"];
  const pesos = [
    1 + (s.promedio < 3.0 ? 2 : 0) + (s.materiasPerdidas >= 2 ? 1 : 0),
    0.8 + (vulnerable ? 1.5 : 0) + 2 * cargaTrabajo,
    0.8 + (p.motivacion < -0.3 ? 1.5 : 0),
    0.6 + (k <= 2 ? 0.8 : 0),
  ];
  return ri.ponderado(tipos, pesos);
}

const DESCRIPCIONES_INTERVENCION: Record<TipoIntervencion, string[]> = {
  TUTORIA: ["Tutorías semanales en las asignaturas con nota baja.", "Plan de mejoramiento académico con monitor par.", "Tutoría de matemáticas y técnicas de estudio."],
  APOYO_ECONOMICO: ["Descuento parcial en la matrícula del siguiente semestre.", "Auxilio de transporte y alimentación de Bienestar.", "Acompañamiento para renovar el crédito educativo y auxilio parcial."],
  ACOMPANAMIENTO_PSICOLOGICO: ["Sesiones de acompañamiento psicológico individual.", "Taller de manejo de estrés y ansiedad ante exámenes.", "Seguimiento psicosocial con la familia."],
  ORIENTACION_VOCACIONAL: ["Orientación vocacional y revisión del plan de carrera.", "Entrevista con el director de programa sobre expectativas.", "Taller de proyecto de vida."],
  OTRO: ["Seguimiento general de Bienestar."],
};

const RESULTADOS_INTERVENCION: Record<TipoIntervencion, string[]> = {
  TUTORIA: ["Asistió a la mayoría de tutorías.", "Mejoró en las evaluaciones finales.", "Asistencia irregular a las tutorías."],
  APOYO_ECONOMICO: ["Apoyo entregado durante el semestre.", "Apoyo aprobado y desembolsado.", "Se gestionó la renovación del crédito."],
  ACOMPANAMIENTO_PSICOLOGICO: ["Completó el ciclo de sesiones.", "Asistió a 4 de 6 sesiones.", "Remitido a la EPS para continuar el proceso."],
  ORIENTACION_VOCACIONAL: ["Confirmó su elección de carrera.", "Ajustó su carga académica.", "Evalúa un cambio de programa."],
  OTRO: ["Seguimiento cerrado."],
};

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

export const nombrePeriodo = (anio: number, semestre: number): string => `${anio}-${semestre}`;

function fechasPeriodo(anio: number, semestre: number): { inicio: Date; fin: Date } {
  return semestre === 1
    ? { inicio: new Date(Date.UTC(anio, 1, 1)), fin: new Date(Date.UTC(anio, 5, 15)) }
    : { inicio: new Date(Date.UTC(anio, 7, 1)), fin: new Date(Date.UTC(anio, 11, 5)) };
}

const redondearMil = (x: number): number => Math.round(x / 1000) * 1000;

// ---------------------------------------------------------------------
// Generación principal
// ---------------------------------------------------------------------

export function generarDataset(opciones: OpcionesGenerador = {}): DatasetSintetico {
  const total = opciones.totalEstudiantes ?? 1500;
  const semilla = opciones.semilla ?? 2026;
  const r = new Aleatorio(semilla);
  // Flujo aleatorio aparte para las intervenciones: así el resto del dataset cambia lo mínimo
  const ri = new Aleatorio(semilla + 101);
  fakerES.seed(semilla);

  // Programas -----------------------------------------------------------------
  const programas: ProgramaSeed[] = PROGRAMAS.map((p) => ({
    id: randomUUID(),
    nombre: p.nombre,
    facultad: p.facultad,
    duracionSemestres: p.duracionSemestres,
    valorSemestre: p.valorSemestre2026,
  }));
  const baseProgramaPorId = new Map<string, ProgramaBase>();
  programas.forEach((p, i) => baseProgramaPorId.set(p.id, PROGRAMAS[i]));

  // Periodos 2018-1 .. 2026-2 ---------------------------------------------------
  const periodos: PeriodoSeed[] = [];
  for (let anio = ANIO_INICIAL; anio <= PERIODO_ACTUAL.anio; anio++) {
    for (const semestre of [1, 2]) {
      const indice = (anio - ANIO_INICIAL) * 2 + (semestre - 1);
      if (indice > INDICE_PERIODO_ACTUAL) continue;
      const { inicio, fin } = fechasPeriodo(anio, semestre);
      periodos.push({
        id: randomUUID(),
        codigo: nombrePeriodo(anio, semestre),
        anio,
        semestre,
        indice,
        fechaInicio: inicio,
        fechaFin: fin,
        activo: indice === INDICE_PERIODO_ACTUAL,
      });
    }
  }

  // Causas ------------------------------------------------------------------------
  const causas: CausaSeed[] = CAUSAS.map((c) => ({
    id: randomUUID(),
    nombre: c.nombre,
    categoria: c.categoria,
    descripcion: c.descripcion,
  }));

  // Cohortes y tamaños -----------------------------------------------------------
  const cohortes: { anio: number; semestre: number; indice: number; peso: number }[] = [];
  for (let anio = ANIO_INICIAL; anio <= ANIO_COHORTE_FINAL; anio++) {
    for (const semestre of [1, 2]) {
      const indice = (anio - ANIO_INICIAL) * 2 + (semestre - 1);
      // Ingresa más gente en el primer semestre; crecimiento leve en el tiempo
      const peso = (semestre === 1 ? 1.25 : 0.75) * (0.85 + 0.05 * (anio - ANIO_INICIAL)) * r.rango(0.9, 1.1);
      cohortes.push({ anio, semestre, indice, peso });
    }
  }
  const pesoTotal = cohortes.reduce((a, c) => a + c.peso, 0);
  const tamanios = cohortes.map((c) => Math.round((total * c.peso) / pesoTotal));
  // Ajuste para que la suma sea exactamente `total`
  let diferencia = total - tamanios.reduce((a, b) => a + b, 0);
  for (let i = 0; diferencia !== 0; i = (i + 1) % tamanios.length) {
    tamanios[i] += diferencia > 0 ? 1 : -1;
    diferencia += diferencia > 0 ? -1 : 1;
  }

  const estudiantes: EstudianteSeed[] = [];
  const matriculas: MatriculaSeed[] = [];
  const notas: NotaSeed[] = [];
  const financiaciones: FinanciacionSeed[] = [];
  const retiros: RetiroSeed[] = [];
  const intervenciones: IntervencionSeed[] = [];

  const periodoPorIndice = new Map(periodos.map((p) => [p.indice, p]));
  let consecutivo = 1;

  for (let ci = 0; ci < cohortes.length; ci++) {
    const cohorte = cohortes[ci];
    const periodoIngreso = periodoPorIndice.get(cohorte.indice)!;

    for (let n = 0; n < tamanios[ci]; n++) {
      // ---- Perfil sociodemográfico ----------------------------------------------
      const programa = r.ponderado(programas, PROGRAMAS.map((p) => p.peso));
      const base = baseProgramaPorId.get(programa.id)!;
      const sexo: Sexo = r.bernoulli(0.015) ? "O" : r.bernoulli(base.probMujer) ? "F" : "M";
      const edadIngreso = Math.round(
        acotar(r.bernoulli(0.82) ? r.normal(17.6, 0.9) : r.normal(24, 5), 16, 45),
      );

      const estratoBruto = r.ponderado([1, 2, 3, 4, 5, 6], [22, 36, 27, 9, 4, 1.2]);
      let estrato = estratoBruto;
      if (r.bernoulli(Math.abs(base.sesgoEstrato) * 0.6)) estrato = acotar(estrato + (base.sesgoEstrato > 0 ? 1 : -1), 1, 6);

      const municipio = r.ponderado(MUNICIPIOS, MUNICIPIOS.map((m) => m.peso));

      const probTrabaja = acotar(0.2 + (edadIngreso >= 22 ? 0.3 : 0) + (estrato <= 2 ? 0.1 : 0) - (estrato >= 4 ? 0.1 : 0), 0.05, 0.85);
      const trabaja = r.bernoulli(probTrabaja);
      const horas = trabaja ? Math.round(acotar(r.normal(26, 12), 6, 48)) : 0;

      const financiacion: TipoFinanciacion = r.ponderado(
        ["RECURSOS_PROPIOS", "ICETEX", "BECA", "CREDITO_UCC"] as const,
        estrato <= 2 ? [30, 33, 17, 20] : estrato === 3 ? [42, 24, 12, 22] : [65, 8, 8, 19],
      );

      const perfil: PerfilEstudiante = {
        habilidad: r.normal(0, 1),
        motivacion: r.normal(0, 1),
        estrato,
        trabaja,
        horas,
        edadIngreso,
        financiacion,
        programa: base,
      };

      const idEstudiante = randomUUID();
      const codigo = `UCC${cohorte.anio}${cohorte.semestre}${String(consecutivo).padStart(4, "0")}`;
      consecutivo++;
      const hashAnonimo = `EST-${createHash("sha256").update(`${codigo}:${semilla}`).digest("hex").slice(0, 10)}`;
      const nombres = fakerES.person.firstName(sexo === "F" ? "female" : sexo === "M" ? "male" : undefined);
      const apellido = () => fakerES.person.lastName().split(" ")[0];
      const apellidos = `${apellido()} ${apellido()}`;

      // ---- Trayectoria semestre a semestre ------------------------------------
      const extra = r.ponderado([0, 1, 2], [70, 20, 10]);
      const semestresPlan = programa.duracionSemestres + extra;
      let indice = cohorte.indice;
      let k = 0;
      let estado: EstadoEstudiante = "ACTIVO";
      let promedioPrevio: number | null = null;
      let semestreActual = 0;
      let totalMatriculas = 0;
      let retiro: RetiroSeed | null = null;

      // Valor de matrícula por periodo: 6% de incremento anual hacia adelante
      const valorEnPeriodo = (anio: number) => redondearMil(programa.valorSemestre / Math.pow(1.06, PERIODO_ACTUAL.anio - anio));

      for (;;) {
        k++;
        const periodo = periodoPorIndice.get(indice)!;
        const valor = valorEnPeriodo(periodo.anio);
        totalMatriculas += valor;
        const sem = simularSemestre(r, perfil, k, promedioPrevio);
        promedioPrevio = sem.promedio;
        semestreActual = k;

        matriculas.push({ id: randomUUID(), estudianteId: idEstudiante, periodoId: periodo.id, semestre: k, valorMatricula: valor });
        notas.push({ id: randomUUID(), estudianteId: idEstudiante, periodoId: periodo.id, semestre: k, ...sem });

        // Semestre en curso: aún no se sabe qué pasará
        if (indice === INDICE_PERIODO_ACTUAL) {
          estado = "ACTIVO";
          break;
        }
        // Fin del plan de estudios => graduado
        if (k >= semestresPlan) {
          estado = "GRADUADO";
          break;
        }
        // ¿Lo interviene Bienestar este semestre? (solo desde 2021 y si está en riesgo)
        let riesgo = probabilidadDesercion(perfil, k, sem);
        if (periodo.anio >= ANIO_INICIO_INTERVENCIONES && riesgo >= UMBRAL_RIESGO_INTERVENCION && ri.bernoulli(coberturaIntervencion(periodo.anio))) {
          const tipo = elegirTipoIntervencion(ri, perfil, sem, k);
          const logit = Math.log(riesgo / (1 - riesgo)) - EFECTO_INTERVENCION[tipo];
          riesgo = sigmoide(logit);
          const ini = periodo.fechaInicio.getTime();
          const fin = periodo.fechaFin.getTime();
          intervenciones.push({
            id: randomUUID(),
            estudianteId: idEstudiante,
            periodoId: periodo.id,
            tipo,
            fecha: new Date(ini + (fin - ini) * ri.rango(0.25, 0.7)),
            descripcion: ri.elegir(DESCRIPCIONES_INTERVENCION[tipo]),
            montoApoyo: tipo === "APOYO_ECONOMICO" ? Math.round((valor * ri.rango(0.3, 0.6)) / 50_000) * 50_000 : null,
            resultado: ri.elegir(RESULTADOS_INTERVENCION[tipo]),
          });
        }
        // ¿Deserta al terminar/durante este semestre?
        if (r.bernoulli(riesgo)) {
          estado = "DESERTOR";
          const causa = elegirCausa(r, perfil, sem, causas, CAUSAS);
          const fin = periodo.fechaFin.getTime();
          const ini = periodo.fechaInicio.getTime();
          retiro = {
            id: randomUUID(),
            estudianteId: idEstudiante,
            periodoId: periodo.id,
            semestreRetiro: k,
            fechaRetiro: new Date(ini + (fin - ini) * r.rango(0.35, 1)),
            causaId: causa.id,
            observacion: null,
          };
          break;
        }
        // ¿Aplaza un semestre? (más probable con carga laboral alta)
        if (r.bernoulli(0.025 + (perfil.trabaja ? 0.02 : 0))) {
          indice += 1; // periodo sin matrícula
          if (indice === INDICE_PERIODO_ACTUAL) {
            estado = "APLAZADO";
            break;
          }
        }
        indice += 1;
      }

      // ---- Financiación ---------------------------------------------------------
      const porcentaje =
        financiacion === "RECURSOS_PROPIOS"
          ? 100
          : financiacion === "BECA"
            ? r.elegir([30, 50, 70, 100])
            : financiacion === "ICETEX"
              ? r.elegir([60, 80, 100])
              : r.elegir([50, 70, 100]);
      const financiado = redondearMil((totalMatriculas * porcentaje) / 100);
      const esDeuda = financiacion === "ICETEX" || financiacion === "CREDITO_UCC";
      let saldo = 0;
      if (esDeuda) {
        const factor = estado === "GRADUADO" ? r.rango(0.45, 0.85) : estado === "DESERTOR" ? r.rango(0.92, 1.03) : r.rango(0.85, 1);
        saldo = redondearMil(financiado * factor);
      }
      financiaciones.push({
        id: randomUUID(),
        estudianteId: idEstudiante,
        tipo: financiacion,
        porcentajeCubierto: porcentaje,
        montoTotal: financiado,
        saldoPendiente: saldo,
        tasaEA: financiacion === "ICETEX" ? 0.11 : financiacion === "CREDITO_UCC" ? 0.14 : 0,
        plazoMeses: esDeuda ? r.elegir([48, 60, 84, 120]) : 0,
      });

      if (retiro) retiros.push(retiro);

      estudiantes.push({
        id: idEstudiante,
        codigo,
        hashAnonimo,
        nombres,
        apellidos,
        sexo,
        edadIngreso,
        estrato,
        municipioOrigen: municipio.nombre,
        departamentoOrigen: municipio.departamento,
        trabaja,
        horasTrabajoSemana: horas,
        programaId: programa.id,
        periodoIngresoId: periodoIngreso.id,
        cohorte: periodoIngreso.codigo,
        cohorteAnio: periodoIngreso.anio,
        semestreActual,
        estado,
        consentimientoDatos: true,
        fechaConsentimiento: periodoIngreso.fechaInicio,
      });
    }
  }

  // Parámetros: globales + salario de enganche por programa ------------------------
  const parametros: ParametroSeed[] = PARAMETROS_BASE.map((p) => ({
    categoria: p.categoria,
    clave: p.clave,
    nombre: p.nombre,
    valor: p.valor,
    unidad: p.unidad,
    descripcion: p.descripcion ?? null,
    fuente: p.fuente ?? null,
    programaId: null,
  }));
  programas.forEach((prog, i) => {
    parametros.push({
      categoria: "SALARIO",
      clave: "salario_profesional_mensual",
      nombre: `Ingreso mensual de enganche — ${prog.nombre}`,
      valor: PROGRAMAS[i].salarioProfesional,
      unidad: "COP",
      descripcion: "Valor de ejemplo para el programa. Actualizar con el OLE.",
      fuente: "Observatorio Laboral para la Educación (MEN) — verificar",
      programaId: prog.id,
    });
  });

  return { programas, periodos, causas, estudiantes, matriculas, notas, financiaciones, retiros, parametros, intervenciones };
}
