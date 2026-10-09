/** Etiquetas legibles para enumeraciones que se muestran en varias pantallas y reportes */
export const TIPO_INTERVENCION: Record<string, string> = {
  TUTORIA: "Tutoría académica",
  APOYO_ECONOMICO: "Apoyo económico",
  ACOMPANAMIENTO_PSICOLOGICO: "Acompañamiento psicológico",
  ORIENTACION_VOCACIONAL: "Orientación vocacional",
  OTRO: "Otra acción",
};

export const ESTADO_INTERVENCION: Record<string, string> = {
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

export const ESTADO_ESTUDIANTE: Record<string, string> = {
  ACTIVO: "Activo",
  GRADUADO: "Graduado",
  DESERTOR: "Desertor",
  APLAZADO: "Aplazado",
};

export const FINANCIACION: Record<string, string> = {
  RECURSOS_PROPIOS: "Recursos propios",
  ICETEX: "ICETEX",
  BECA: "Beca",
  CREDITO_UCC: "Crédito UCC",
};
