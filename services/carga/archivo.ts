import { ErrorCSV, parsearCSV, type TablaCSV } from "./csv";
import { validarTabla, type ResultadoLectura } from "./lector";

/**
 * Lectura de un archivo de estudiantes (CSV o Excel) a partir de sus bytes. No depende del servidor:
 * la usan TANTO el servicio de carga como el Web Worker que revisa el archivo en el navegador antes
 * de subirlo, así la vista previa y la carga real aplican exactamente las mismas reglas.
 */

/** El archivo no se pudo leer (formato no admitido, Excel dañado, comilla sin cerrar…) */
export class ErrorArchivo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorArchivo";
  }
}

/** Texto de un CSV: UTF-8, y si trae caracteres inválidos (archivo guardado por Excel en Windows), Latin-1 */
export function decodificarTexto(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("�") ? new TextDecoder("latin1").decode(buffer) : utf8;
}

export type FormatoArchivo = "xlsx" | "csv";

export function formatoDe(nombre: string): FormatoArchivo | null {
  const ext = nombre.toLowerCase().split(".").pop();
  if (ext === "xlsx") return "xlsx";
  if (ext === "csv" || ext === "txt") return "csv";
  return null;
}

/** Convierte los bytes en la tabla de encabezados y filas */
export async function leerTabla(nombre: string, buffer: ArrayBuffer): Promise<TablaCSV> {
  const formato = formatoDe(nombre);
  if (formato === "xlsx") {
    try {
      // Import dinámico: ExcelJS pesa cerca de 1 MB y solo se descarga si el archivo es Excel
      const { leerExcel } = await import("./excel");
      return await leerExcel(buffer);
    } catch {
      throw new ErrorArchivo("No se pudo leer el archivo de Excel. Guárdalo como .xlsx o como CSV e inténtalo de nuevo.");
    }
  }
  if (formato === "csv") {
    try {
      return parsearCSV(decodificarTexto(buffer));
    } catch (e) {
      if (e instanceof ErrorCSV) throw new ErrorArchivo(e.message);
      throw e;
    }
  }
  throw new ErrorArchivo("Formato no admitido. Sube un archivo .xlsx o .csv (puedes partir de la plantilla).");
}

/** Lee y valida: estudiantes válidos, errores por fila y columnas reconocidas */
export async function leerYValidar(nombre: string, buffer: ArrayBuffer): Promise<ResultadoLectura> {
  return validarTabla(await leerTabla(nombre, buffer));
}
