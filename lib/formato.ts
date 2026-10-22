/**
 * Formato de números y fechas en español de Colombia, en un solo lugar.
 *
 * Crear un Intl.NumberFormat o Intl.DateTimeFormat es costoso (carga los datos de la configuración
 * regional), y `toLocaleString` crea uno nuevo en cada llamada. Aquí se crean una vez por combinación
 * de opciones y se reutilizan (un Map como caché), lo que importa en tablas con cientos de filas.
 * Las fechas siempre se muestran en la hora de Colombia, aunque el servidor corra en otra zona.
 */
const LOCALE = "es-CO";
export const ZONA_HORARIA = "America/Bogota";

const numeros = new Map<string, Intl.NumberFormat>();
const fechas = new Map<string, Intl.DateTimeFormat>();

function formateadorNumero(opciones: Intl.NumberFormatOptions): Intl.NumberFormat {
  const clave = JSON.stringify(opciones);
  let f = numeros.get(clave);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, opciones);
    numeros.set(clave, f);
  }
  return f;
}

function formateadorFecha(opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const clave = JSON.stringify(opciones);
  let f = fechas.get(clave);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: ZONA_HORARIA, ...opciones });
    fechas.set(clave, f);
  }
  return f;
}

/** 1234.5 -> "1.234,5" (por defecto hasta 3 decimales, como toLocaleString) */
export function formatoNumero(valor: number, decimales: { min?: number; max?: number } = {}): string {
  return formateadorNumero({ minimumFractionDigits: decimales.min, maximumFractionDigits: decimales.max }).format(valor);
}

/** 1234.6 -> "1.235" */
export function formatoEntero(valor: number): string {
  return formatoNumero(valor, { max: 0 });
}

/** Fracción como porcentaje: 0.004 -> "+0,4 %" (con signo) ; 0.2 -> "20 %" */
export function formatoPorcentaje(fraccion: number, opciones: { decimales?: number; signo?: boolean } = {}): string {
  const texto = formatoNumero(fraccion * 100, { max: opciones.decimales ?? 0 });
  return `${opciones.signo && fraccion > 0 ? "+" : ""}${texto} %`;
}

type Fecha = Date | string;
const aFecha = (f: Fecha) => (typeof f === "string" ? new Date(f) : f);

/** "20/10/2026" */
export function formatoFecha(fecha: Fecha): string {
  return formateadorFecha({}).format(aFecha(fecha));
}

/** "20/10/2026, 9:36 a. m." */
export function formatoFechaHora(fecha: Fecha): string {
  return formateadorFecha({ dateStyle: "medium", timeStyle: "short" }).format(aFecha(fecha));
}

/** "20 de octubre de 2026" */
export function formatoFechaLarga(fecha: Fecha): string {
  return formateadorFecha({ day: "numeric", month: "long", year: "numeric" }).format(aFecha(fecha));
}
