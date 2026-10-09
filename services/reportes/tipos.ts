/**
 * Modelo de datos de un reporte, independiente del formato de salida.
 * Los servicios arman un `DatosReporte` y `GeneradorReportes` lo convierte a Excel o PDF:
 * así el contenido se define una sola vez y los dos formatos siempre coinciden.
 */

export type TipoReporte = "institucional" | "riesgo" | "intervenciones" | "impacto-institucional";
export type FormatoReporte = "pdf" | "xlsx";

/**
 * Formato de cada columna. Convenciones de los valores:
 *  - "pct": el número ya viene en porcentaje (30.8 significa 30,8 %).
 *  - "cop": pesos colombianos sin decimales.
 */
export type FormatoColumna = "texto" | "entero" | "decimal" | "pct" | "cop";

export interface ColumnaReporte {
  titulo: string;
  formato: FormatoColumna;
  /** Ancho sugerido en caracteres (Excel); en PDF se reparte automáticamente */
  ancho?: number;
}

export type Celda = string | number | null;

export interface TablaReporte {
  columnas: ColumnaReporte[];
  filas: Celda[][];
}

export interface Indicador {
  etiqueta: string;
  valor: string;
  detalle?: string;
}

export interface BarraReporte {
  etiqueta: string;
  valor: number;
}

export interface GraficoBarras {
  titulo: string;
  formato: "pct" | "cop" | "entero";
  datos: BarraReporte[];
}

export interface SeccionReporte {
  titulo: string;
  descripcion?: string;
  /** Nombre corto de la hoja de Excel para la tabla de esta sección (máx. 31 caracteres) */
  hoja?: string;
  indicadores?: Indicador[];
  barras?: GraficoBarras;
  tabla?: TablaReporte;
  notas?: string[];
}

export interface DatosReporte {
  tipo: TipoReporte;
  titulo: string;
  subtitulo: string;
  generadoEn: Date;
  /** Rol de quien exporta (nunca su nombre: el reporte puede circular) */
  generadoPorRol: string;
  filtros: string[];
  secciones: SeccionReporte[];
  avisoPrivacidad: string;
}

export const AVISO_PRIVACIDAD =
  "Información anonimizada conforme a la Ley 1581 de 2012 (habeas data): los estudiantes se identifican con un código anónimo y no se incluyen nombres, documentos ni datos de contacto. Uso exclusivo para la gestión de la permanencia en la UCC.";

export const TITULOS_REPORTE: Record<TipoReporte, { titulo: string; descripcion: string }> = {
  institucional: {
    titulo: "Reporte institucional de deserción",
    descripcion: "Indicadores agregados por programa, cohorte, semestre y periodo; causas y dimensión regional.",
  },
  riesgo: {
    titulo: "Lista priorizada de riesgo (alerta temprana)",
    descripcion: "Estudiantes activos ordenados por puntaje de riesgo, con los factores que más pesan. Anonimizada.",
  },
  intervenciones: {
    titulo: "Efectividad de las intervenciones de Bienestar",
    descripcion: "Permanencia de estudiantes intervenidos frente a no intervenidos con riesgo comparable.",
  },
  "impacto-institucional": {
    titulo: "Impacto institucional y regional de la deserción",
    descripcion: "Matrícula no percibida, graduación por cohorte, pérdida de ingresos regional y proyección.",
  },
};
