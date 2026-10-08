/** Instrumento de autoevaluación del riesgo de deserción (escala Likert 1-5) */

export type Dimension = "ECONOMICA" | "ACADEMICA" | "MOTIVACION" | "ENTORNO";

export interface Pregunta {
  clave: string;
  dimension: Dimension;
  texto: string;
  /** true si estar DE ACUERDO indica MENOR riesgo (la escala se invierte al puntuar) */
  invertida: boolean;
  /** Peso dentro de su dimensión */
  peso: number;
}

export const ESCALA = [
  { valor: 1, etiqueta: "Totalmente en desacuerdo" },
  { valor: 2, etiqueta: "En desacuerdo" },
  { valor: 3, etiqueta: "Ni de acuerdo ni en desacuerdo" },
  { valor: 4, etiqueta: "De acuerdo" },
  { valor: 5, etiqueta: "Totalmente de acuerdo" },
] as const;

export const DIMENSIONES: Record<Dimension, { titulo: string; descripcion: string; peso: number }> = {
  ECONOMICA: { titulo: "Situación económica", descripcion: "Recursos para pagar y sostener tus estudios.", peso: 0.3 },
  ACADEMICA: { titulo: "Situación académica", descripcion: "Cómo te va en tus materias y con tu forma de estudiar.", peso: 0.3 },
  MOTIVACION: { titulo: "Motivación", descripcion: "Qué tan seguro(a) te sientes con tu carrera.", peso: 0.25 },
  ENTORNO: { titulo: "Entorno", descripcion: "Familia, salud y sentido de pertenencia.", peso: 0.15 },
};

export const PREGUNTAS: Pregunta[] = [
  { clave: "e1", dimension: "ECONOMICA", texto: "Tengo los recursos para pagar la matrícula del próximo semestre.", invertida: true, peso: 1.5 },
  { clave: "e2", dimension: "ECONOMICA", texto: "Me preocupa no poder cubrir transporte, alimentación o materiales.", invertida: false, peso: 1 },
  { clave: "e3", dimension: "ECONOMICA", texto: "Necesito trabajar para sostenerme o ayudar a mi familia.", invertida: false, peso: 1 },
  { clave: "e4", dimension: "ECONOMICA", texto: "Mis obligaciones laborales me dejan tiempo suficiente para estudiar.", invertida: true, peso: 1 },
  { clave: "a1", dimension: "ACADEMICA", texto: "Entiendo los temas de mis asignaturas actuales.", invertida: true, peso: 1 },
  { clave: "a2", dimension: "ACADEMICA", texto: "Este semestre estoy en riesgo de perder una o más materias.", invertida: false, peso: 1.5 },
  { clave: "a3", dimension: "ACADEMICA", texto: "Me cuesta organizar mi tiempo para estudiar.", invertida: false, peso: 1 },
  { clave: "a4", dimension: "ACADEMICA", texto: "Sé a quién acudir cuando tengo dudas académicas.", invertida: true, peso: 0.75 },
  { clave: "m1", dimension: "MOTIVACION", texto: "Estoy seguro(a) de que elegí la carrera correcta.", invertida: true, peso: 1 },
  { clave: "m2", dimension: "MOTIVACION", texto: "He pensado seriamente en retirarme este semestre.", invertida: false, peso: 2 },
  { clave: "m3", dimension: "MOTIVACION", texto: "Me imagino graduándome de este programa.", invertida: true, peso: 1 },
  { clave: "m4", dimension: "MOTIVACION", texto: "Lo que estudio se relaciona con lo que quiero hacer en mi vida.", invertida: true, peso: 0.75 },
  { clave: "n1", dimension: "ENTORNO", texto: "Mi familia apoya que siga estudiando.", invertida: true, peso: 1 },
  { clave: "n2", dimension: "ENTORNO", texto: "Me siento parte de la comunidad universitaria.", invertida: true, peso: 0.75 },
  { clave: "n3", dimension: "ENTORNO", texto: "Tengo problemas de salud (física o emocional) que afectan mis estudios.", invertida: false, peso: 1.25 },
  { clave: "n4", dimension: "ENTORNO", texto: "Tengo responsabilidades de cuidado (hijos, familiares) que me dificultan estudiar.", invertida: false, peso: 1 },
];

/** Pregunta que, por sí sola, eleva el nivel: intención explícita de retirarse */
export const CLAVE_INTENCION_RETIRO = "m2";

export interface Recurso {
  dimension: Dimension;
  titulo: string;
  descripcion: string;
  comoAcceder: string;
}

/**
 * Recursos institucionales sugeridos según la dimensión con más riesgo.
 * Se describen de forma general: la universidad debe completar contactos y horarios vigentes.
 */
export const RECURSOS: Recurso[] = [
  { dimension: "ECONOMICA", titulo: "Apoyo financiero y becas", descripcion: "Becas, descuentos por convenio, financiación directa y orientación para créditos educativos (ICETEX y crédito UCC).", comoAcceder: "Oficina de Bienestar Universitario y área financiera de la sede." },
  { dimension: "ECONOMICA", titulo: "Calculadora de impacto", descripcion: "Antes de decidir, compara retirarte con aplazar, cambiar de jornada o pedir apoyo financiero.", comoAcceder: "Menú: Calculadora de impacto." },
  { dimension: "ACADEMICA", titulo: "Tutorías y monitorías académicas", descripcion: "Acompañamiento en las asignaturas con más dificultad y estrategias para organizar tu tiempo de estudio.", comoAcceder: "Coordinación de tu programa o Bienestar Universitario." },
  { dimension: "MOTIVACION", titulo: "Orientación vocacional", descripcion: "Espacio para revisar tus intereses, tu proyecto de vida y alternativas dentro de la universidad (cambio de programa, jornada o modalidad).", comoAcceder: "Bienestar Universitario." },
  { dimension: "MOTIVACION", titulo: "Acompañamiento psicológico", descripcion: "Atención confidencial para manejar estrés, ansiedad o situaciones personales que afecten tus estudios.", comoAcceder: "Servicio de apoyo psicológico de Bienestar Universitario." },
  { dimension: "ENTORNO", titulo: "Bienestar universitario", descripcion: "Programas de salud, deporte, cultura y redes de apoyo entre estudiantes para fortalecer tu vida universitaria.", comoAcceder: "Bienestar Universitario de la sede Pasto." },
];
