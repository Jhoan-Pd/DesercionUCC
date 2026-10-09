import type { Celda, FormatoColumna } from "./tipos";

/** Texto de una celda en formato colombiano (lo usan el PDF y las vistas previas) */
export function formatearCelda(valor: Celda, formato: FormatoColumna): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "string") return valor;
  switch (formato) {
    case "entero":
      return Math.round(valor).toLocaleString("es-CO");
    case "decimal":
      return valor.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "pct":
      return `${valor.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
    case "cop":
      return `$ ${Math.round(valor).toLocaleString("es-CO")}`;
    case "texto":
      return String(valor);
  }
}

/** Formato numérico de Excel equivalente a cada formato de columna */
export const FORMATO_EXCEL: Record<FormatoColumna, string | undefined> = {
  texto: undefined,
  entero: "#,##0",
  decimal: "#,##0.00",
  // El valor se guarda como fracción (0,308) para que Excel lo trate como porcentaje real
  pct: "0.0%",
  cop: '"$"#,##0',
};

/**
 * Nombre de hoja válido para Excel: máximo 31 caracteres, sin : \ / ? * [ ] y único dentro del libro.
 */
export function nombreHoja(deseado: string, usados: Set<string>): string {
  const limpio = deseado.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Hoja";
  let nombre = limpio;
  for (let i = 2; usados.has(nombre.toLowerCase()); i++) {
    const sufijo = ` (${i})`;
    nombre = `${limpio.slice(0, 31 - sufijo.length)}${sufijo}`;
  }
  usados.add(nombre.toLowerCase());
  return nombre;
}

/** Fecha y hora de Colombia legibles: "9 de octubre de 2026, 17:45" */
export function fechaReporte(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(fecha);
}

/** Nombre de archivo seguro: observatorio-<tipo>-AAAA-MM-DD.<ext> */
export function nombreArchivo(tipo: string, fecha: Date, extension: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
  return `observatorio-${tipo}-${partes}.${extension}`;
}
