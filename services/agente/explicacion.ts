import type { FactorRiesgo, NivelRiesgo } from "@/services/riesgo/factores";
import { VARIABLE, describirValor, tieneValor, type ClaveVariable, type DatosEstudiante } from "@/services/riesgo/variables";
import { ETIQUETA_NIVEL } from "@/services/riesgo/niveles";

const APOYO_ECONOMICO = "Verificar si cumple los requisitos de los apoyos económicos de la universidad (becas, subsidios, crédito).";
const PRIMER_ANIO = "Incluirlo en el acompañamiento de primer año (inducción, mentorías entre pares).";
const NIVELACION = "Ofrecer cursos de nivelación en competencias básicas (lectura, matemáticas).";

/**
 * Acciones de Bienestar sugeridas para cada factor. La clave es la regla del puntaje por factores
 * (p. ej. "saber11") o la variable del modelo (p. ej. "puntajeSaber11"): por eso varias comparten texto.
 * Se usan en la explicación básica y como guía para el agente.
 */
export const ACCIONES: Readonly<Record<string, string>> = {
  promedio: "Tutoría o monitoría en las materias con dificultad y un plan de mejoramiento con su consejero académico.",
  materiasPerdidas: "Revisar con el estudiante las materias perdidas y su carga del próximo periodo; ofrecer tutorías.",
  asistencia: "Contactarlo para conocer la causa de las inasistencias (salud, trabajo, transporte, motivación).",
  moraMatricula: "Orientarlo sobre acuerdos de pago, créditos educativos o becas disponibles.",
  vulnerabilidadEconomica: APOYO_ECONOMICO,
  estrato: APOYO_ECONOMICO,
  apoyoFinanciero: APOYO_ECONOMICO,
  trabaja: "Explorar horarios o una carga académica compatible con su trabajo.",
  primerosSemestres: PRIMER_ANIO,
  semestre: PRIMER_ANIO,
  saber11: NIVELACION,
  puntajeSaber11: NIVELACION,
  edad: "Conversar sobre sus responsabilidades fuera de la universidad y los apoyos que necesita.",
};

const nivelTexto = (n: NivelRiesgo) => ETIQUETA_NIVEL[n].toLowerCase();

export interface EntradaExplicacion {
  programa: string;
  datos: DatosEstudiante;
  puntaje: number;
  nivel: NivelRiesgo;
  metodo: "FACTORES" | "MODELO";
  factores: FactorRiesgo[];
  faltantes: ClaveVariable[];
}

/** Acciones sin repetir, en el orden de los factores */
export function accionesSugeridas(factores: FactorRiesgo[], maximo = 3): string[] {
  // Un Set conserva el orden de inserción y descarta repetidas en O(1)
  const acciones = new Set<string>();
  for (const f of factores) {
    if (acciones.size >= maximo) break;
    const a = ACCIONES[f.clave];
    if (a) acciones.add(a);
  }
  return [...acciones];
}

/** Explicación sin IA (se usa si no hay clave de Gemini o si Gemini falla). Determinista y verificable. */
export function explicacionBasica(e: EntradaExplicacion): string {
  const lineas: string[] = [];
  const metodo = e.metodo === "MODELO" ? "el modelo entrenado con estudiantes de la UCC" : "el puntaje por factores de riesgo";
  if (e.factores.length === 0) {
    lineas.push(`Riesgo ${nivelTexto(e.nivel)} (${e.puntaje}/100) según ${metodo}: con los datos disponibles no aparece ningún factor de alerta.`);
  } else {
    lineas.push(`Riesgo ${nivelTexto(e.nivel)} (${e.puntaje}/100) según ${metodo}. Lo que más pesa:`);
    for (const f of e.factores.slice(0, 4)) lineas.push(`• ${e.metodo === "MODELO" ? `${f.etiqueta}: ${f.detalle}` : f.detalle}`);
  }
  const acciones = accionesSugeridas(e.factores);
  if (acciones.length > 0) {
    lineas.push("", "Acciones sugeridas:");
    acciones.forEach((a) => lineas.push(`• ${a}`));
  }
  if (e.faltantes.length > 0) {
    lineas.push("", `Datos que no venían en el archivo: ${e.faltantes.map((f) => VARIABLE[f].etiqueta.toLowerCase()).join(", ")}. Con ellos la evaluación sería más completa.`);
  }
  return lineas.join("\n");
}

export const SISTEMA_EXPLICACION = `Eres un asistente del área de Bienestar Universitario de la Universidad Cooperativa de Colombia, sede Pasto.
Redactas explicaciones breves sobre el riesgo de deserción de UN estudiante para el equipo de Bienestar.
Reglas:
- Usa solo los datos que te entregan. No inventes datos, causas ni cifras.
- El nivel de riesgo es una alerta para ofrecer acompañamiento, no un juicio sobre la persona ni una predicción segura.
- Escribe en español, en tono respetuoso, máximo 130 palabras.
- Estructura: un párrafo corto con el porqué del nivel de riesgo y luego 2 o 3 acciones concretas de Bienestar en viñetas (•).
- Si faltan datos importantes, menciónalo en una frase al final.
- No uses encabezados ni negritas.`;

/** Mensaje para Gemini con los datos SIN nombre ni código del estudiante */
export function promptExplicacion(e: EntradaExplicacion): string {
  const datos = (Object.keys(e.datos) as ClaveVariable[]).filter((k) => tieneValor(e.datos[k])).map((k) => `- ${describirValor(k, e.datos[k] as number | boolean)}`);
  const factores = e.factores.length ? e.factores.map((f) => `- ${f.etiqueta} (+${f.puntos} puntos): ${f.detalle}`) : ["- Ninguno"];
  const metodo =
    e.metodo === "MODELO"
      ? "Modelo de regresión logística entrenado con estudiantes reales de la UCC (el puntaje es la probabilidad estimada de retirarse, en %)."
      : "Puntaje por factores (criterio experto basado en los factores de deserción del Ministerio de Educación – SPADIES); es una alerta de 0 a 100, no una probabilidad.";
  const acciones = accionesSugeridas(e.factores).map((a) => `- ${a}`);
  return [
    `Programa: ${e.programa}`,
    `Nivel de riesgo: ${nivelTexto(e.nivel)} (${e.puntaje}/100)`,
    `Método: ${metodo}`,
    "",
    "Datos del estudiante:",
    ...datos,
    "",
    "Factores que suman al riesgo:",
    ...factores,
    "",
    `Datos faltantes: ${e.faltantes.length ? e.faltantes.map((f) => VARIABLE[f].etiqueta).join(", ") : "ninguno"}`,
    "",
    "Acciones que suele ofrecer Bienestar para estos factores (puedes usarlas o adaptarlas):",
    ...(acciones.length ? acciones : ["- Seguimiento periódico."]),
  ].join("\n");
}
