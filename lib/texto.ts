/**
 * Utilidades de texto en español (funciones puras, sin dependencias).
 * Un solo lugar para quitar tildes, comparar nombres y darles formato, que antes estaba repetido en
 * el lector de archivos, los datos abiertos y las herramientas del agente.
 */

/** Marcas diacríticas que quedan separadas al descomponer el texto (NFD): tildes, diéresis, virgulilla */
const MARCAS_DIACRITICAS = /[̀-ͯ]/g;

/** "Ingeniería" -> "Ingenieria" ; "Año" -> "Ano" */
export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(MARCAS_DIACRITICAS, "");
}

/** Valor de una celda para compararlo con una lista de opciones: sin tildes, sin espacios a los lados y en minúsculas */
export function normalizarValor(texto: string): string {
  return sinTildes(texto).trim().toLowerCase();
}

/** Clave para agrupar o buscar nombres que solo difieren en mayúsculas, tildes o espacios ("ODONTOLOGIA" = "Odontología") */
export function claveNombre(nombre: string): string {
  return sinTildes(nombre).toUpperCase().replace(/\s+/g, " ").trim();
}

/** Palabras que van en minúscula dentro de un nombre propio (salvo al inicio) */
const PALABRAS_MENORES = new Set(["de", "del", "la", "las", "los", "y", "e", "en", "a", "con", "para", "por"]);

/** "ESPECIALIZACIÓN EN DERECHO  PROCESAL PENAL" -> "Especialización en Derecho Procesal Penal" */
export function formatoTitulo(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((palabra, i) => (i > 0 && PALABRAS_MENORES.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)))
    .join(" ");
}
