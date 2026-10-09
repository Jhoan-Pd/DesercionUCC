import { campoCSV, claveTexto, normalizarEncabezado, parsearCSV, type Separador } from "./csv";

/**
 * Valida un CSV de estudiantes reales ANTES de tocar la base de datos.
 *
 * Formato: una fila por estudiante y semestre cursado (como un reporte de notas de Registro
 * Académico). Los datos del estudiante se repiten en cada fila y deben coincidir entre sí.
 *
 * Es una clase pura: recibe los catálogos válidos (programas, periodos y causas) y devuelve los
 * estudiantes agrupados más la lista de errores con fila, columna y mensaje. La importación es
 * "todo o nada": si hay un solo error no se importa nada, para no dejar trayectorias a medias.
 */

export type SexoImport = "F" | "M" | "O";
export type EstadoImport = "ACTIVO" | "GRADUADO" | "DESERTOR" | "APLAZADO";
export type FinanciacionImport = "RECURSOS_PROPIOS" | "ICETEX" | "BECA" | "CREDITO_UCC";

export interface ColumnaImportacion {
  clave: string;
  requerida: boolean;
  descripcion: string;
  ejemplo: string;
}

export const COLUMNAS: ColumnaImportacion[] = [
  { clave: "codigo", requerida: true, descripcion: "Código institucional del estudiante", ejemplo: "UCC2024100123" },
  { clave: "nombres", requerida: true, descripcion: "Nombres", ejemplo: "Laura Camila" },
  { clave: "apellidos", requerida: true, descripcion: "Apellidos", ejemplo: "Rosero Benavides" },
  { clave: "sexo", requerida: true, descripcion: "F, M u O (también femenino, masculino, otro)", ejemplo: "F" },
  { clave: "edad_ingreso", requerida: true, descripcion: "Edad al ingresar (15 a 70)", ejemplo: "18" },
  { clave: "estrato", requerida: true, descripcion: "Estrato socioeconómico (1 a 6)", ejemplo: "2" },
  { clave: "municipio", requerida: true, descripcion: "Municipio de origen", ejemplo: "Ipiales" },
  { clave: "departamento", requerida: true, descripcion: "Departamento de origen", ejemplo: "Nariño" },
  { clave: "trabaja", requerida: true, descripcion: "Sí o no", ejemplo: "si" },
  { clave: "horas_trabajo", requerida: true, descripcion: "Horas de trabajo por semana (0 si no trabaja)", ejemplo: "20" },
  { clave: "programa", requerida: true, descripcion: "Nombre del programa tal como existe en el sistema", ejemplo: "Ingeniería de Sistemas" },
  { clave: "cohorte", requerida: true, descripcion: "Periodo de ingreso (AAAA-1 o AAAA-2)", ejemplo: "2024-1" },
  { clave: "estado", requerida: true, descripcion: "ACTIVO, GRADUADO, DESERTOR o APLAZADO", ejemplo: "ACTIVO" },
  { clave: "financiacion", requerida: true, descripcion: "RECURSOS_PROPIOS, ICETEX, BECA o CREDITO_UCC", ejemplo: "ICETEX" },
  { clave: "porcentaje_financiacion", requerida: true, descripcion: "% de la matrícula que cubre esa fuente (0 a 100)", ejemplo: "80" },
  { clave: "semestre", requerida: true, descripcion: "Número de semestre cursado (1 a 16)", ejemplo: "3" },
  { clave: "periodo", requerida: true, descripcion: "Periodo en que cursó ese semestre (AAAA-1 o AAAA-2)", ejemplo: "2025-1" },
  { clave: "promedio", requerida: true, descripcion: "Promedio del semestre (0,0 a 5,0; coma o punto decimal)", ejemplo: "3,6" },
  { clave: "materias_inscritas", requerida: true, descripcion: "Materias inscritas en el semestre", ejemplo: "6" },
  { clave: "materias_perdidas", requerida: true, descripcion: "Materias perdidas en el semestre", ejemplo: "1" },
  { clave: "asistencia", requerida: true, descripcion: "Asistencia del semestre en % (0 a 100)", ejemplo: "88" },
  { clave: "valor_matricula", requerida: false, descripcion: "Valor pagado ese semestre (COP). Si falta se usa el del programa", ejemplo: "4300000" },
  { clave: "saldo_deuda", requerida: false, descripcion: "Deuda vigente con ICETEX o crédito UCC (COP)", ejemplo: "12500000" },
  { clave: "causa_retiro", requerida: false, descripcion: "Obligatoria si el estado es DESERTOR; debe existir en el catálogo de causas", ejemplo: "" },
  { clave: "consentimiento", requerida: false, descripcion: "Autorización de tratamiento de datos (Ley 1581). Por defecto: sí", ejemplo: "si" },
];

const REQUERIDAS = COLUMNAS.filter((c) => c.requerida).map((c) => c.clave);
const CONOCIDAS = new Set(COLUMNAS.map((c) => c.clave));

/** Campos del estudiante que deben coincidir en todas sus filas */
const CAMPOS_ESTUDIANTE = [
  "nombres", "apellidos", "sexo", "edad_ingreso", "estrato", "municipio", "departamento", "trabaja", "horas_trabajo",
  "programa", "cohorte", "estado", "financiacion", "porcentaje_financiacion", "saldo_deuda", "causa_retiro", "consentimiento",
] as const;

/** Pueden escribirse solo en una de las filas del estudiante (por ejemplo, la causa en la fila del retiro) */
const OPCIONALES_POR_FILA = new Set<string>(["causa_retiro", "saldo_deuda", "consentimiento"]);

export const MAX_FILAS = 10_000;
const MAX_ERRORES_MOSTRADOS = 300;

export interface ErrorImportacion {
  /** Línea del archivo (1 = encabezado) */
  linea: number;
  columna: string;
  valor: string;
  mensaje: string;
}

export interface SemestreImportado {
  linea: number;
  semestre: number;
  periodo: string;
  promedio: number;
  materiasInscritas: number;
  materiasPerdidas: number;
  asistenciaPct: number;
  valorMatricula: number | null;
}

export interface EstudianteImportado {
  codigo: string;
  nombres: string;
  apellidos: string;
  sexo: SexoImport;
  edadIngreso: number;
  estrato: number;
  municipioOrigen: string;
  departamentoOrigen: string;
  trabaja: boolean;
  horasTrabajoSemana: number;
  /** Nombre canónico del programa (como está en el catálogo) */
  programa: string;
  cohorte: string;
  estado: EstadoImport;
  financiacion: { tipo: FinanciacionImport; porcentaje: number; saldoDeuda: number | null };
  /** Nombre canónico de la causa (solo desertores) */
  causaRetiro: string | null;
  consentimiento: boolean;
  semestres: SemestreImportado[];
}

export interface ResultadoAnalisis {
  separador: Separador;
  columnasFaltantes: string[];
  columnasIgnoradas: string[];
  errores: ErrorImportacion[];
  totalErrores: number;
  estudiantes: EstudianteImportado[];
  resumen: { filas: number; estudiantes: number; semestres: number; desertores: number };
  valido: boolean;
}

export interface CatalogosImportacion {
  programas: string[];
  periodos: string[];
  causas: string[];
}

// ---------------------------------------------------------------------
// Conversión de celdas (lanzan un mensaje en español si el valor no sirve)
// ---------------------------------------------------------------------

class ValorInvalido extends Error {}

const ALIAS_SEXO: Record<string, SexoImport> = { f: "F", femenino: "F", mujer: "F", m: "M", masculino: "M", hombre: "M", o: "O", otro: "O" };
const ALIAS_ESTADO: Record<string, EstadoImport> = {
  activo: "ACTIVO", graduado: "GRADUADO", egresado: "GRADUADO", desertor: "DESERTOR", retirado: "DESERTOR", aplazado: "APLAZADO",
};
const ALIAS_FINANCIACION: Record<string, FinanciacionImport> = {
  recursos_propios: "RECURSOS_PROPIOS", propios: "RECURSOS_PROPIOS", contado: "RECURSOS_PROPIOS",
  icetex: "ICETEX", beca: "BECA", credito_ucc: "CREDITO_UCC", credito: "CREDITO_UCC",
};
const SI = new Set(["si", "s", "true", "1", "x", "yes"]);
const NO = new Set(["no", "n", "false", "0", ""]);

function aEntero(v: string, min: number, max: number): number {
  const limpio = v.replace(/[.\s$]/g, "");
  if (!/^-?\d+$/.test(limpio)) throw new ValorInvalido("Debe ser un número entero");
  const n = Number(limpio);
  if (n < min || n > max) throw new ValorInvalido(`Debe estar entre ${min.toLocaleString("es-CO")} y ${max.toLocaleString("es-CO")}`);
  return n;
}

function aDecimal(v: string, min: number, max: number): number {
  const limpio = v.replace(",", ".").replace(/\s|%/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) throw new ValorInvalido("Debe ser un número (use coma o punto decimal)");
  const n = Number(limpio);
  if (n < min || n > max) throw new ValorInvalido(`Debe estar entre ${min} y ${max}`);
  return n;
}

function aBooleano(v: string): boolean {
  const k = normalizarEncabezado(v);
  if (SI.has(k)) return true;
  if (NO.has(k)) return false;
  throw new ValorInvalido('Escriba "sí" o "no"');
}

function aEnum<T>(v: string, alias: Record<string, T>, opciones: string): T {
  const valor = alias[normalizarEncabezado(v)];
  if (valor === undefined) throw new ValorInvalido(`Valor no permitido. Opciones: ${opciones}`);
  return valor;
}

function aPeriodo(v: string): string {
  const m = v.trim().match(/^(\d{4})\s*-\s*([12])$/);
  if (!m) throw new ValorInvalido("Formato de periodo AAAA-1 o AAAA-2 (por ejemplo 2025-1)");
  return `${m[1]}-${m[2]}`;
}

function aTexto(v: string, max = 120): string {
  const t = v.trim().replace(/\s+/g, " ");
  if (!t) throw new ValorInvalido("No puede estar vacío");
  if (t.length > max) throw new ValorInvalido(`Máximo ${max} caracteres`);
  return t;
}

const indicePeriodo = (codigo: string) => {
  const [a, s] = codigo.split("-").map(Number);
  return a * 2 + (s - 1);
};

// ---------------------------------------------------------------------
// Importador
// ---------------------------------------------------------------------

export class ImportadorCSV {
  private readonly programas: Map<string, string>;
  private readonly periodos: Set<string>;
  private readonly causas: Map<string, string>;

  constructor(catalogos: CatalogosImportacion) {
    this.programas = new Map(catalogos.programas.map((p) => [claveTexto(p), p]));
    this.periodos = new Set(catalogos.periodos);
    this.causas = new Map(catalogos.causas.map((c) => [claveTexto(c), c]));
  }

  analizar(texto: string): ResultadoAnalisis {
    const tabla = parsearCSV(texto);
    const errores: ErrorImportacion[] = [];
    const error = (linea: number, columna: string, valor: string, mensaje: string) => errores.push({ linea, columna, valor, mensaje });

    // 1) Encabezados
    const claves = tabla.encabezados.map(normalizarEncabezado);
    const columnasFaltantes = REQUERIDAS.filter((c) => !claves.includes(c));
    const columnasIgnoradas = tabla.encabezados.filter((_, i) => !CONOCIDAS.has(claves[i]));
    const duplicadas = claves.filter((c, i) => CONOCIDAS.has(c) && claves.indexOf(c) !== i);
    for (const d of new Set(duplicadas)) error(1, d, "", "La columna está repetida en el encabezado");

    const vacio = (extra: Partial<ResultadoAnalisis> = {}): ResultadoAnalisis => ({
      separador: tabla.separador,
      columnasFaltantes,
      columnasIgnoradas,
      errores: errores.slice(0, MAX_ERRORES_MOSTRADOS),
      totalErrores: errores.length,
      estudiantes: [],
      resumen: { filas: tabla.filas.length, estudiantes: 0, semestres: 0, desertores: 0 },
      valido: false,
      ...extra,
    });

    if (tabla.encabezados.length === 0) {
      error(1, "", "", "El archivo está vacío");
      return vacio();
    }
    if (columnasFaltantes.length) {
      error(1, columnasFaltantes.join(", "), "", `Faltan columnas obligatorias: ${columnasFaltantes.join(", ")}. Descargue la plantilla para ver el formato.`);
      return vacio();
    }
    if (tabla.filas.length === 0) {
      error(2, "", "", "El archivo no tiene filas de datos");
      return vacio();
    }
    if (tabla.filas.length > MAX_FILAS) {
      error(1, "", String(tabla.filas.length), `El archivo tiene ${tabla.filas.length.toLocaleString("es-CO")} filas; el máximo por importación es ${MAX_FILAS.toLocaleString("es-CO")}. Divídalo en varios archivos.`);
      return vacio();
    }

    // 2) Filas
    const porCodigo = new Map<string, { primera: { linea: number; crudos: Record<string, string> }; est: EstudianteImportado }>();

    for (const fila of tabla.filas) {
      const crudos: Record<string, string> = {};
      claves.forEach((c, i) => {
        if (CONOCIDAS.has(c) && !(c in crudos)) crudos[c] = fila.valores[i] ?? "";
      });
      if (fila.valores.length !== tabla.encabezados.length) {
        error(fila.linea, "", "", `La fila tiene ${fila.valores.length} columnas y el encabezado ${tabla.encabezados.length}. Revise separadores o comillas.`);
        continue;
      }
      const erroresAntes = errores.length;
      const leer = <T,>(columna: string, conversor: (v: string) => T): T | undefined => {
        const valor = crudos[columna] ?? "";
        try {
          return conversor(valor);
        } catch (e) {
          error(fila.linea, columna, valor, e instanceof ValorInvalido ? e.message : "Valor inválido");
          return undefined;
        }
      };

      const codigo = leer("codigo", (v) => {
        const t = aTexto(v, 30);
        if (!/^[A-Za-z0-9-]+$/.test(t)) throw new ValorInvalido("Solo letras, números y guiones");
        return t.toUpperCase();
      });
      const nombres = leer("nombres", (v) => aTexto(v, 80));
      const apellidos = leer("apellidos", (v) => aTexto(v, 80));
      const sexo = leer("sexo", (v) => aEnum(v, ALIAS_SEXO, "F, M, O"));
      const edadIngreso = leer("edad_ingreso", (v) => aEntero(v, 15, 70));
      const estrato = leer("estrato", (v) => aEntero(v, 1, 6));
      const municipio = leer("municipio", (v) => aTexto(v, 80));
      const departamento = leer("departamento", (v) => aTexto(v, 80));
      const trabaja = leer("trabaja", aBooleano);
      const horas = leer("horas_trabajo", (v) => aEntero(v || "0", 0, 80));
      const programa = leer("programa", (v) => {
        const canonico = this.programas.get(claveTexto(aTexto(v)));
        if (!canonico) throw new ValorInvalido("El programa no existe en el sistema (créelo primero en Admin → Programas)");
        return canonico;
      });
      const cohorte = leer("cohorte", aPeriodo);
      const estado = leer("estado", (v) => aEnum(v, ALIAS_ESTADO, "ACTIVO, GRADUADO, DESERTOR, APLAZADO"));
      const tipoFin = leer("financiacion", (v) => aEnum(v, ALIAS_FINANCIACION, "RECURSOS_PROPIOS, ICETEX, BECA, CREDITO_UCC"));
      const porcentaje = leer("porcentaje_financiacion", (v) => aDecimal(v, 0, 100));
      const semestre = leer("semestre", (v) => aEntero(v, 1, 16));
      const periodo = leer("periodo", (v) => {
        const p = aPeriodo(v);
        if (!this.periodos.has(p)) throw new ValorInvalido("El periodo no existe en el sistema (créelo en Admin → Periodos)");
        return p;
      });
      const promedio = leer("promedio", (v) => aDecimal(v, 0, 5));
      const inscritas = leer("materias_inscritas", (v) => aEntero(v, 0, 15));
      const perdidas = leer("materias_perdidas", (v) => aEntero(v, 0, 15));
      const asistencia = leer("asistencia", (v) => aDecimal(v, 0, 100));
      const valorMatricula = leer("valor_matricula", (v) => (v.trim() === "" ? null : aEntero(v, 0, 200_000_000)));
      const saldoDeuda = leer("saldo_deuda", (v) => (v.trim() === "" ? null : aEntero(v, 0, 2_000_000_000)));
      const causa = leer("causa_retiro", (v) => {
        if (v.trim() === "") return null;
        const canonica = this.causas.get(claveTexto(v));
        if (!canonica) throw new ValorInvalido("La causa no existe en el catálogo de causas de deserción");
        return canonica;
      });
      const consentimiento = leer("consentimiento", (v) => (v.trim() === "" ? true : aBooleano(v)));

      // Reglas que relacionan columnas de la misma fila
      if (inscritas !== undefined && perdidas !== undefined && perdidas > inscritas) {
        error(fila.linea, "materias_perdidas", crudos.materias_perdidas, "No puede ser mayor que las materias inscritas");
      }
      if (trabaja === false && horas !== undefined && horas > 0) error(fila.linea, "horas_trabajo", crudos.horas_trabajo, 'Si "trabaja" es no, las horas deben ser 0');
      if (trabaja === true && horas === 0) error(fila.linea, "horas_trabajo", crudos.horas_trabajo, 'Si "trabaja" es sí, indique las horas por semana');
      if (cohorte && periodo && indicePeriodo(periodo) < indicePeriodo(cohorte)) {
        error(fila.linea, "periodo", crudos.periodo, `Es anterior a la cohorte de ingreso (${cohorte})`);
      }
      if (cohorte && !this.periodos.has(cohorte)) error(fila.linea, "cohorte", crudos.cohorte, "La cohorte no existe como periodo en el sistema");

      if (errores.length > erroresAntes || codigo === undefined) continue;

      const semestreImportado: SemestreImportado = {
        linea: fila.linea,
        semestre: semestre!,
        periodo: periodo!,
        promedio: Math.round(promedio! * 100) / 100,
        materiasInscritas: inscritas!,
        materiasPerdidas: perdidas!,
        asistenciaPct: Math.round(asistencia! * 10) / 10,
        valorMatricula: valorMatricula ?? null,
      };

      const previo = porCodigo.get(codigo);
      if (!previo) {
        porCodigo.set(codigo, {
          primera: { linea: fila.linea, crudos },
          est: {
            codigo,
            nombres: nombres!,
            apellidos: apellidos!,
            sexo: sexo!,
            edadIngreso: edadIngreso!,
            estrato: estrato!,
            municipioOrigen: municipio!,
            departamentoOrigen: departamento!,
            trabaja: trabaja!,
            horasTrabajoSemana: horas!,
            programa: programa!,
            cohorte: cohorte!,
            estado: estado!,
            financiacion: { tipo: tipoFin!, porcentaje: porcentaje!, saldoDeuda: saldoDeuda ?? null },
            causaRetiro: causa ?? null,
            consentimiento: consentimiento!,
            semestres: [semestreImportado],
          },
        });
        continue;
      }

      // Las columnas del estudiante deben coincidir con su primera fila. Las opcionales (causa,
      // saldo, consentimiento) pueden venir solo en una fila: se aceptan vacías y se completan.
      for (const campo of CAMPOS_ESTUDIANTE) {
        const a = normalizarEncabezado(previo.primera.crudos[campo] ?? "");
        const b = normalizarEncabezado(crudos[campo] ?? "");
        if (OPCIONALES_POR_FILA.has(campo) && (a === "" || b === "")) continue;
        if (a !== b) error(fila.linea, campo, crudos[campo] ?? "", `No coincide con la fila ${previo.primera.linea} del mismo estudiante ("${previo.primera.crudos[campo] ?? ""}")`);
      }
      if (previo.est.causaRetiro === null && causa) previo.est.causaRetiro = causa;
      if (previo.est.financiacion.saldoDeuda === null && saldoDeuda != null) previo.est.financiacion.saldoDeuda = saldoDeuda;
      if (!previo.primera.crudos.consentimiento && crudos.consentimiento) previo.est.consentimiento = consentimiento!;
      const repetido = previo.est.semestres.find((s) => s.semestre === semestreImportado.semestre || s.periodo === semestreImportado.periodo);
      if (repetido) {
        const columna = repetido.semestre === semestreImportado.semestre ? "semestre" : "periodo";
        error(fila.linea, columna, crudos[columna], `Repetido: el estudiante ya tiene ese ${columna} en la fila ${repetido.linea}`);
        continue;
      }
      previo.est.semestres.push(semestreImportado);
    }

    // 3) Reglas por estudiante
    const estudiantes = [...porCodigo.values()].map((v) => v.est);
    for (const est of estudiantes) {
      est.semestres.sort((a, b) => a.semestre - b.semestre);
      const linea = est.semestres[0].linea;
      // A mayor semestre, periodo posterior (se permiten huecos por aplazamientos)
      for (let i = 1; i < est.semestres.length; i++) {
        if (indicePeriodo(est.semestres[i].periodo) <= indicePeriodo(est.semestres[i - 1].periodo)) {
          error(est.semestres[i].linea, "periodo", est.semestres[i].periodo, `El semestre ${est.semestres[i].semestre} debe ser posterior al semestre ${est.semestres[i - 1].semestre} (${est.semestres[i - 1].periodo})`);
        }
      }
      if (est.estado === "DESERTOR" && !est.causaRetiro) error(linea, "causa_retiro", "", "Un estudiante DESERTOR debe tener causa de retiro");
      if (est.estado !== "DESERTOR" && est.causaRetiro) error(linea, "causa_retiro", est.causaRetiro, "La causa de retiro solo aplica a estudiantes con estado DESERTOR");
      const esCredito = est.financiacion.tipo === "ICETEX" || est.financiacion.tipo === "CREDITO_UCC";
      if (!esCredito && (est.financiacion.saldoDeuda ?? 0) > 0) error(linea, "saldo_deuda", String(est.financiacion.saldoDeuda), "Solo ICETEX o crédito UCC pueden tener saldo de deuda");
    }

    errores.sort((a, b) => a.linea - b.linea);
    const valido = errores.length === 0;
    return {
      separador: tabla.separador,
      columnasFaltantes,
      columnasIgnoradas,
      errores: errores.slice(0, MAX_ERRORES_MOSTRADOS),
      totalErrores: errores.length,
      estudiantes: valido ? estudiantes : [],
      resumen: {
        filas: tabla.filas.length,
        estudiantes: estudiantes.length,
        semestres: estudiantes.reduce((s, e) => s + e.semestres.length, 0),
        desertores: estudiantes.filter((e) => e.estado === "DESERTOR").length,
      },
      valido,
    };
  }

  /**
   * Plantilla con el encabezado y dos estudiantes de ejemplo (uno activo y uno desertor) que
   * pasan la validación con los catálogos actuales. Separador ";" para que Excel en español la abra en columnas.
   */
  static plantilla(catalogos: CatalogosImportacion): string {
    const periodos = [...catalogos.periodos].sort((a, b) => indicePeriodo(a) - indicePeriodo(b));
    const ultimos = periodos.slice(-3);
    const programa = catalogos.programas.find((p) => claveTexto(p) === claveTexto("Ingeniería de Sistemas")) ?? catalogos.programas[0] ?? "Ingeniería de Sistemas";
    const causa = catalogos.causas.find((c) => claveTexto(c).includes("economicas")) ?? catalogos.causas[0] ?? "";
    const [p1, p2, p3] = ultimos.length === 3 ? ultimos : ["2025-1", "2025-2", "2026-1"];

    const activo = { codigo: "EJEMPLO-001", nombres: "Laura Camila", apellidos: "Rosero Benavides", sexo: "F", edad: "18", estrato: "2", municipio: "Ipiales", depto: "Nariño", trabaja: "no", horas: "0", cohorte: p1, estado: "ACTIVO", fin: "ICETEX", pct: "80", saldo: "", causa: "" };
    const desertor = { codigo: "EJEMPLO-002", nombres: "Andrés Felipe", apellidos: "Gómez Muñoz", sexo: "M", edad: "21", estrato: "1", municipio: "Pasto", depto: "Nariño", trabaja: "sí", horas: "30", cohorte: p1, estado: "DESERTOR", fin: "RECURSOS_PROPIOS", pct: "100", saldo: "", causa };

    const filas: string[][] = [];
    const agregar = (e: typeof activo, semestre: number, periodo: string, promedio: string, ins: number, per: number, asis: string) =>
      filas.push([e.codigo, e.nombres, e.apellidos, e.sexo, e.edad, e.estrato, e.municipio, e.depto, e.trabaja, e.horas, programa, e.cohorte, e.estado, e.fin, e.pct, String(semestre), periodo, promedio, String(ins), String(per), asis, "", e.saldo, e.causa, "si"]);
    agregar(activo, 1, p1, "3,8", 6, 0, "92");
    agregar(activo, 2, p2, "3,6", 6, 1, "88");
    agregar(activo, 3, p3, "3,9", 6, 0, "90");
    agregar(desertor, 1, p1, "2,9", 6, 2, "75");
    agregar(desertor, 2, p2, "2,4", 6, 4, "61");

    const encabezado = COLUMNAS.map((c) => c.clave);
    return [encabezado, ...filas].map((f) => f.map((v) => campoCSV(v, ";")).join(";")).join("\r\n") + "\r\n";
  }
}
