import type { CategoriaCausa } from "@prisma/client";

/** Rango de periodos del dataset: 2018-1 ... 2026-2 (índice 0..17) */
export const ANIO_INICIAL = 2018;
export const ANIO_COHORTE_FINAL = 2025;
export const PERIODO_ACTUAL = { anio: 2026, semestre: 2 } as const;
export const INDICE_PERIODO_ACTUAL = (PERIODO_ACTUAL.anio - ANIO_INICIAL) * 2 + (PERIODO_ACTUAL.semestre - 1); // 17

export interface ProgramaBase {
  nombre: string;
  facultad: string;
  duracionSemestres: number;
  /** Valor de matrícula por semestre en 2026 (COP) — dato de ejemplo editable */
  valorSemestre2026: number;
  /** Peso en el reparto de estudiantes */
  peso: number;
  /** Ajuste del logit de deserción (positivo = más deserción) */
  riesgoBase: number;
  /** Probabilidad de que el estudiante sea mujer */
  probMujer: number;
  /** Ingreso mensual de enganche de un profesional recién graduado (COP) — dato de ejemplo (ver OLE) */
  salarioProfesional: number;
  /** Desplazamiento del estrato (programas más costosos atraen estratos más altos) */
  sesgoEstrato: number;
}

export const PROGRAMAS: ProgramaBase[] = [
  { nombre: "Ingeniería de Sistemas", facultad: "Ingenierías", duracionSemestres: 10, valorSemestre2026: 4_300_000, peso: 17, riesgoBase: 0.35, probMujer: 0.25, salarioProfesional: 3_200_000, sesgoEstrato: 0 },
  { nombre: "Derecho", facultad: "Derecho y Ciencias Sociales", duracionSemestres: 10, valorSemestre2026: 4_700_000, peso: 17, riesgoBase: -0.1, probMujer: 0.6, salarioProfesional: 2_800_000, sesgoEstrato: 0.1 },
  { nombre: "Psicología", facultad: "Ciencias Sociales y de la Salud", duracionSemestres: 10, valorSemestre2026: 4_500_000, peso: 14, riesgoBase: -0.1, probMujer: 0.78, salarioProfesional: 2_400_000, sesgoEstrato: 0 },
  { nombre: "Contaduría Pública", facultad: "Ciencias Económicas", duracionSemestres: 9, valorSemestre2026: 3_800_000, peso: 11, riesgoBase: 0.1, probMujer: 0.62, salarioProfesional: 2_500_000, sesgoEstrato: -0.15 },
  { nombre: "Administración de Empresas", facultad: "Ciencias Económicas", duracionSemestres: 9, valorSemestre2026: 3_900_000, peso: 10, riesgoBase: 0.15, probMujer: 0.58, salarioProfesional: 2_500_000, sesgoEstrato: -0.1 },
  { nombre: "Odontología", facultad: "Ciencias de la Salud", duracionSemestres: 10, valorSemestre2026: 9_800_000, peso: 8, riesgoBase: -0.4, probMujer: 0.68, salarioProfesional: 3_600_000, sesgoEstrato: 0.7 },
  { nombre: "Medicina", facultad: "Ciencias de la Salud", duracionSemestres: 12, valorSemestre2026: 16_500_000, peso: 8, riesgoBase: -0.5, probMujer: 0.6, salarioProfesional: 5_500_000, sesgoEstrato: 0.9 },
  { nombre: "Enfermería", facultad: "Ciencias de la Salud", duracionSemestres: 9, valorSemestre2026: 4_600_000, peso: 8, riesgoBase: -0.15, probMujer: 0.85, salarioProfesional: 2_600_000, sesgoEstrato: -0.1 },
  { nombre: "Ingeniería Civil", facultad: "Ingenierías", duracionSemestres: 10, valorSemestre2026: 4_400_000, peso: 7, riesgoBase: 0.3, probMujer: 0.3, salarioProfesional: 3_000_000, sesgoEstrato: 0 },
];

export interface CausaBase {
  nombre: string;
  categoria: CategoriaCausa;
  descripcion: string;
  /** Peso relativo dentro de su categoría */
  peso: number;
  /** Etiqueta de afinidad para elegir la causa según el perfil del estudiante */
  afinidad?: "trabajo" | "dinero" | "rendimiento" | "vocacion" | "salud" | "familia";
}

/** Causas clasificadas según las categorías de determinantes del MEN (SPADIES) */
export const CAUSAS: CausaBase[] = [
  // Individuales
  { nombre: "Cambio de orientación vocacional", categoria: "INDIVIDUAL", descripcion: "El estudiante decide cambiar de carrera o de área de estudio.", peso: 3, afinidad: "vocacion" },
  { nombre: "Insatisfacción con el programa elegido", categoria: "INDIVIDUAL", descripcion: "El programa no cumplió las expectativas del estudiante.", peso: 3, afinidad: "vocacion" },
  { nombre: "Problemas de salud física", categoria: "INDIVIDUAL", descripcion: "Condiciones de salud que impiden continuar.", peso: 1.2, afinidad: "salud" },
  { nombre: "Problemas de salud mental o emocional", categoria: "INDIVIDUAL", descripcion: "Ansiedad, depresión u otras condiciones emocionales.", peso: 2, afinidad: "salud" },
  { nombre: "Embarazo o responsabilidades de cuidado", categoria: "INDIVIDUAL", descripcion: "Cuidado de hijos o familiares dependientes.", peso: 1.6, afinidad: "familia" },
  { nombre: "Cambio de ciudad de residencia", categoria: "INDIVIDUAL", descripcion: "Traslado del núcleo familiar o del estudiante.", peso: 1.2, afinidad: "familia" },
  // Académicas
  { nombre: "Bajo rendimiento académico", categoria: "ACADEMICA", descripcion: "Promedio bajo o repetición de asignaturas.", peso: 5, afinidad: "rendimiento" },
  { nombre: "Pérdida de beca o crédito por promedio", categoria: "ACADEMICA", descripcion: "No cumplir el promedio exigido para renovar el beneficio.", peso: 2, afinidad: "rendimiento" },
  { nombre: "Deficiencias en la formación previa", categoria: "ACADEMICA", descripcion: "Vacíos del bachillerato en matemáticas, lectura o ciencias.", peso: 2.4, afinidad: "rendimiento" },
  { nombre: "Exceso de carga académica", categoria: "ACADEMICA", descripcion: "Carga de créditos incompatible con otras obligaciones.", peso: 1.4, afinidad: "trabajo" },
  // Socioeconómicas
  { nombre: "Dificultades económicas del hogar", categoria: "SOCIOECONOMICA", descripcion: "Ingresos familiares insuficientes para costear la carrera.", peso: 5, afinidad: "dinero" },
  { nombre: "Conflicto entre trabajo y estudio", categoria: "SOCIOECONOMICA", descripcion: "Horarios laborales incompatibles con las clases.", peso: 4.5, afinidad: "trabajo" },
  { nombre: "No renovación del crédito o beca", categoria: "SOCIOECONOMICA", descripcion: "Pérdida del financiamiento por trámites o requisitos.", peso: 2.2, afinidad: "dinero" },
  { nombre: "Costos de sostenimiento (transporte, vivienda)", categoria: "SOCIOECONOMICA", descripcion: "Gastos de manutención durante el semestre.", peso: 2.6, afinidad: "dinero" },
  // Institucionales
  { nombre: "Insatisfacción con metodología o docentes", categoria: "INSTITUCIONAL", descripcion: "Percepción de baja calidad en la enseñanza.", peso: 2.4 },
  { nombre: "Horarios o disponibilidad de cursos", categoria: "INSTITUCIONAL", descripcion: "Oferta de asignaturas que no se ajusta a las necesidades.", peso: 2.2, afinidad: "trabajo" },
  { nombre: "Infraestructura o recursos insuficientes", categoria: "INSTITUCIONAL", descripcion: "Laboratorios, biblioteca o conectividad limitados.", peso: 1.2 },
  { nombre: "Falta de acompañamiento institucional", categoria: "INSTITUCIONAL", descripcion: "Poco seguimiento o apoyo por parte de la universidad.", peso: 2 },
  { nombre: "Procesos administrativos o financieros", categoria: "INSTITUCIONAL", descripcion: "Trámites de matrícula, pagos o certificaciones complejos.", peso: 1.2, afinidad: "dinero" },
];

export const MUNICIPIOS: { nombre: string; departamento: string; peso: number }[] = [
  { nombre: "Pasto", departamento: "Nariño", peso: 46 },
  { nombre: "Ipiales", departamento: "Nariño", peso: 7 },
  { nombre: "Tumaco", departamento: "Nariño", peso: 5 },
  { nombre: "Túquerres", departamento: "Nariño", peso: 4 },
  { nombre: "La Unión", departamento: "Nariño", peso: 3 },
  { nombre: "Sandoná", departamento: "Nariño", peso: 3 },
  { nombre: "Samaniego", departamento: "Nariño", peso: 2.5 },
  { nombre: "Chachagüí", departamento: "Nariño", peso: 2.2 },
  { nombre: "Yacuanquer", departamento: "Nariño", peso: 2 },
  { nombre: "Consacá", departamento: "Nariño", peso: 1.5 },
  { nombre: "La Florida", departamento: "Nariño", peso: 1.5 },
  { nombre: "Buesaco", departamento: "Nariño", peso: 2 },
  { nombre: "El Tambo", departamento: "Nariño", peso: 1.5 },
  { nombre: "Cumbal", departamento: "Nariño", peso: 1.5 },
  { nombre: "Guachucal", departamento: "Nariño", peso: 1.3 },
  { nombre: "Taminango", departamento: "Nariño", peso: 1.2 },
  { nombre: "Tangua", departamento: "Nariño", peso: 1.1 },
  { nombre: "Mocoa", departamento: "Putumayo", peso: 2.5 },
  { nombre: "Sibundoy", departamento: "Putumayo", peso: 1.3 },
  { nombre: "Popayán", departamento: "Cauca", peso: 2 },
  { nombre: "Cali", departamento: "Valle del Cauca", peso: 1.5 },
];

/**
 * Parámetros de referencia (editables por el ADMIN desde la app).
 * IMPORTANTE: son valores iniciales de ejemplo para el prototipo; verifique y
 * actualice con las fuentes oficiales (Observatorio Laboral para la Educación y SPADIES).
 */
export interface ParametroBase {
  categoria: "SALARIO" | "COSTO" | "FINANCIERO" | "ESCENARIO" | "SPADIES";
  clave: string;
  nombre: string;
  valor: number;
  unidad: string;
  descripcion?: string;
  fuente?: string;
}

const OLE = "Observatorio Laboral para la Educación (MEN) — verificar en ole.mineducacion.gov.co";
const SPADIES = "SPADIES — Ministerio de Educación Nacional";

export const PARAMETROS_BASE: ParametroBase[] = [
  // ---- Salarios de referencia (OLE) ----
  { categoria: "SALARIO", clave: "smmlv", nombre: "Salario mínimo mensual legal vigente (SMMLV 2026)", valor: 1_750_905, unidad: "COP", descripcion: "Decretos 1469 y 1470 de 2025.", fuente: "Decreto 1469 de 2025" },
  { categoria: "SALARIO", clave: "salario_bachiller_mensual", nombre: "Ingreso mensual de un bachiller (sin título superior)", valor: 1_750_905, unidad: "COP", descripcion: "Se toma como referencia 1 SMMLV. Ajustar con OLE/DANE (GEIH).", fuente: OLE },
  { categoria: "SALARIO", clave: "salario_tecnico_mensual", nombre: "Ingreso mensual de enganche — técnico profesional", valor: 1_950_000, unidad: "COP", descripcion: "Valor de ejemplo; actualizar con el OLE.", fuente: OLE },
  { categoria: "SALARIO", clave: "salario_tecnologo_mensual", nombre: "Ingreso mensual de enganche — tecnólogo", valor: 2_300_000, unidad: "COP", descripcion: "Valor de ejemplo; actualizar con el OLE.", fuente: OLE },
  { categoria: "SALARIO", clave: "salario_profesional_mensual", nombre: "Ingreso mensual de enganche — profesional universitario (general)", valor: 2_900_000, unidad: "COP", descripcion: "Se usa cuando el programa no tiene un valor propio.", fuente: OLE },
  { categoria: "SALARIO", clave: "crecimiento_real_profesional", nombre: "Crecimiento real anual del ingreso — profesional", valor: 5, unidad: "%", descripcion: "Incremento del salario por experiencia, descontando inflación.", fuente: "Supuesto del modelo" },
  { categoria: "SALARIO", clave: "crecimiento_real_tecnologo", nombre: "Crecimiento real anual del ingreso — técnico/tecnólogo", valor: 3, unidad: "%", fuente: "Supuesto del modelo" },
  { categoria: "SALARIO", clave: "crecimiento_real_bachiller", nombre: "Crecimiento real anual del ingreso — bachiller", valor: 1.5, unidad: "%", fuente: "Supuesto del modelo" },
  { categoria: "SALARIO", clave: "meses_pago_anio", nombre: "Meses de ingreso por año", valor: 12, unidad: "meses", descripcion: "Use 13–14 si desea incluir prima y cesantías.", fuente: "Supuesto del modelo" },
  { categoria: "SALARIO", clave: "tasa_descuento", nombre: "Tasa de descuento real anual (valor presente neto)", valor: 7, unidad: "%", descripcion: "Refleja que el dinero de hoy vale más que el de mañana.", fuente: "Supuesto del modelo" },
  // ---- Costos ----
  { categoria: "COSTO", clave: "transporte_mensual", nombre: "Transporte mensual del estudiante", valor: 120_000, unidad: "COP", fuente: "Estimación" },
  { categoria: "COSTO", clave: "materiales_semestre", nombre: "Materiales, libros y fotocopias por semestre", valor: 350_000, unidad: "COP", fuente: "Estimación" },
  { categoria: "COSTO", clave: "sostenimiento_mensual", nombre: "Sostenimiento mensual (alimentación, vivienda, servicios)", valor: 650_000, unidad: "COP", fuente: "Estimación" },
  { categoria: "COSTO", clave: "meses_por_semestre", nombre: "Meses por semestre académico", valor: 6, unidad: "meses", fuente: "Calendario académico" },
  // ---- Financiero ----
  { categoria: "FINANCIERO", clave: "tasa_icetex_ea", nombre: "Tasa efectiva anual de referencia — ICETEX", valor: 11, unidad: "%", descripcion: "Verifique la línea de crédito específica en ICETEX.", fuente: "Referencia ICETEX" },
  { categoria: "FINANCIERO", clave: "tasa_credito_ucc_ea", nombre: "Tasa efectiva anual de referencia — Crédito UCC", valor: 14, unidad: "%", fuente: "Referencia UCC" },
  { categoria: "FINANCIERO", clave: "plazo_amortizacion_meses", nombre: "Plazo de amortización de la deuda", valor: 60, unidad: "meses", fuente: "Supuesto del modelo" },
  // ---- Escenarios ----
  { categoria: "ESCENARIO", clave: "aplazar_semestres", nombre: "Semestres que se aplaza en el escenario 'aplazar'", valor: 1, unidad: "semestres", fuente: "Supuesto del modelo" },
  { categoria: "ESCENARIO", clave: "nocturna_factor_duracion", nombre: "Factor de duración al pasar a jornada nocturna/virtual", valor: 1.25, unidad: "factor", descripcion: "1.25 = la carrera dura 25% más porque se cursan menos créditos por semestre.", fuente: "Supuesto del modelo" },
  { categoria: "ESCENARIO", clave: "nocturna_descuento_matricula", nombre: "Descuento de matrícula en jornada nocturna/virtual", valor: 10, unidad: "%", fuente: "Supuesto del modelo" },
  { categoria: "ESCENARIO", clave: "nocturna_factor_ingreso", nombre: "Ingreso laboral mientras estudia en jornada nocturna/virtual", valor: 0.9, unidad: "factor", descripcion: "Fracción del ingreso de bachiller que gana trabajando mientras estudia.", fuente: "Supuesto del modelo" },
  { categoria: "ESCENARIO", clave: "apoyo_porcentaje_beca", nombre: "Porcentaje de matrícula cubierto por un apoyo financiero", valor: 50, unidad: "%", fuente: "Supuesto del modelo" },
  // ---- Referencias nacionales SPADIES ----
  { categoria: "SPADIES", clave: "spadies_desercion_anual_universitaria", nombre: "Deserción anual — nivel universitario (nacional)", valor: 7.82, unidad: "%", descripcion: "Dato 2023 reportado por el MEN para el nivel universitario.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_desercion_anual_total", nombre: "Deserción anual — total educación superior (nacional)", valor: 8.97, unidad: "%", descripcion: "Dato 2023 reportado por el MEN.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem1", nombre: "Deserción acumulada por cohorte — semestre 1", valor: 9.7, unidad: "%", descripcion: "Cohorte 2016-1, total educación superior.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem2", nombre: "Deserción acumulada por cohorte — semestre 2", valor: 13.65, unidad: "%", descripcion: "Interpolado entre los semestres 1 y 5.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem3", nombre: "Deserción acumulada por cohorte — semestre 3", valor: 17.6, unidad: "%", descripcion: "Interpolado entre los semestres 1 y 5.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem4", nombre: "Deserción acumulada por cohorte — semestre 4", valor: 21.55, unidad: "%", descripcion: "Interpolado entre los semestres 1 y 5.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem5", nombre: "Deserción acumulada por cohorte — semestre 5", valor: 25.5, unidad: "%", descripcion: "Cohorte 2016-1, total educación superior.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem6", nombre: "Deserción acumulada por cohorte — semestre 6", valor: 27.74, unidad: "%", descripcion: "Interpolado entre los semestres 5 y 10.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem7", nombre: "Deserción acumulada por cohorte — semestre 7", valor: 29.98, unidad: "%", descripcion: "Interpolado entre los semestres 5 y 10.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem8", nombre: "Deserción acumulada por cohorte — semestre 8", valor: 32.22, unidad: "%", descripcion: "Interpolado entre los semestres 5 y 10.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem9", nombre: "Deserción acumulada por cohorte — semestre 9", valor: 34.46, unidad: "%", descripcion: "Interpolado entre los semestres 5 y 10.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_cohorte_sem10", nombre: "Deserción acumulada por cohorte — semestre 10", valor: 36.7, unidad: "%", descripcion: "Cohorte 2016-1, total educación superior.", fuente: SPADIES },
  { categoria: "SPADIES", clave: "spadies_causa_socioeconomica", nombre: "Participación de causas socioeconómicas (referencia)", valor: 40, unidad: "%", descripcion: "Valor ILUSTRATIVO inicial: reemplazar con la distribución oficial de SPADIES.", fuente: "Ejemplo — reemplazar" },
  { categoria: "SPADIES", clave: "spadies_causa_academica", nombre: "Participación de causas académicas (referencia)", valor: 25, unidad: "%", descripcion: "Valor ILUSTRATIVO inicial: reemplazar con la distribución oficial de SPADIES.", fuente: "Ejemplo — reemplazar" },
  { categoria: "SPADIES", clave: "spadies_causa_individual", nombre: "Participación de causas individuales (referencia)", valor: 25, unidad: "%", descripcion: "Valor ILUSTRATIVO inicial: reemplazar con la distribución oficial de SPADIES.", fuente: "Ejemplo — reemplazar" },
  { categoria: "SPADIES", clave: "spadies_causa_institucional", nombre: "Participación de causas institucionales (referencia)", valor: 10, unidad: "%", descripcion: "Valor ILUSTRATIVO inicial: reemplazar con la distribución oficial de SPADIES.", fuente: "Ejemplo — reemplazar" },
];
