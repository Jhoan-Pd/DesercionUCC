import type { ErrorFila } from "@/services/carga/lector";
import type { FormatoArchivo } from "@/services/carga/archivo";

/**
 * Mensajes entre la página «Cargar datos» y el Web Worker que revisa el archivo (postMessage).
 * Cada pedido lleva un id: si el usuario elige otro archivo, la respuesta del anterior se descarta.
 * El ArrayBuffer viaja TRANSFERIDO (no copiado): el worker se queda con los bytes sin duplicar memoria.
 */
export interface PedidoValidacion {
  id: number;
  nombre: string;
  buffer: ArrayBuffer;
}

export interface VistaPrevia {
  formato: FormatoArchivo;
  /** Filas de datos leídas (válidas + con error) */
  filas: number;
  validas: number;
  conError: number;
  /** Primeros errores, con su número de fila */
  errores: ErrorFila[];
  /** Encabezados que no se reconocieron (se ignoran) */
  ignoradas: string[];
  /** Columnas opcionales que no vienen: esos factores no se evaluarán */
  sinColumna: string[];
  /** Estudiantes válidos por estado: los retirados y graduados sirven para entrenar el modelo */
  estados: { ACTIVO: number; RETIRADO: number; GRADUADO: number };
  milisegundos: number;
}

export type EtapaValidacion = "leyendo" | "validando";

export type RespuestaValidacion =
  | { id: number; tipo: "progreso"; etapa: EtapaValidacion }
  | { id: number; tipo: "lista"; vista: VistaPrevia }
  | { id: number; tipo: "error"; mensaje: string };

/** Errores que se envían a la página (el total se informa aparte) */
export const MAX_ERRORES_VISTA = 50;
