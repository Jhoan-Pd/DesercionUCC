/**
 * Lector de CSV sin dependencias (RFC 4180): comillas dobles, comillas escapadas (""),
 * saltos de línea dentro de comillas, BOM de UTF-8 y finales de línea de Windows.
 *
 * Detecta el separador: Excel en español (configuración regional de Colombia) guarda los CSV
 * con punto y coma (;) porque la coma es el separador decimal.
 */

export type Separador = "," | ";" | "\t";

export interface TablaCSV {
  separador: Separador;
  encabezados: string[];
  /** Filas de datos (sin el encabezado); cada una con su número de línea en el archivo */
  filas: { linea: number; valores: string[] }[];
}

/** Elige el separador que más aparece en la primera línea, fuera de comillas */
export function detectarSeparador(primeraLinea: string): Separador {
  const cuenta: Record<Separador, number> = { ",": 0, ";": 0, "\t": 0 };
  let enComillas = false;
  for (const ch of primeraLinea) {
    if (ch === '"') enComillas = !enComillas;
    else if (!enComillas && (ch === "," || ch === ";" || ch === "\t")) cuenta[ch]++;
  }
  const [mejor] = (Object.entries(cuenta) as [Separador, number][]).sort((a, b) => b[1] - a[1]);
  return mejor[1] > 0 ? mejor[0] : ",";
}

export function parsearCSV(texto: string): TablaCSV {
  const contenido = texto.replace(/^﻿/, "");
  const primeraLinea = contenido.split(/\r?\n/, 1)[0] ?? "";
  const separador = detectarSeparador(primeraLinea);

  const registros: { linea: number; valores: string[] }[] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  let linea = 1;
  let lineaInicio = 1;

  const cerrarFila = () => {
    fila.push(campo);
    campo = "";
    // Ignora filas completamente vacías (frecuentes al final de los archivos de Excel)
    if (fila.some((v) => v.trim() !== "")) registros.push({ linea: lineaInicio, valores: fila });
    fila = [];
  };

  for (let i = 0; i < contenido.length; i++) {
    const ch = contenido[i];
    if (enComillas) {
      if (ch === '"') {
        if (contenido[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else {
        if (ch === "\n") linea++;
        campo += ch;
      }
      continue;
    }
    if (ch === '"') enComillas = true;
    else if (ch === separador) {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && contenido[i + 1] === "\n") i++;
      cerrarFila();
      linea++;
      lineaInicio = linea;
    } else campo += ch;
  }
  if (campo !== "" || fila.length > 0) cerrarFila();

  const [encabezado, ...datos] = registros;
  return {
    separador,
    encabezados: (encabezado?.valores ?? []).map((v) => v.trim()),
    filas: datos.map((r) => ({ linea: r.linea, valores: r.valores.map((v) => v.trim()) })),
  };
}

/** Normaliza un encabezado: minúsculas, sin tildes, espacios y guiones como "_" ("Edad Ingreso" -> "edad_ingreso") */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Compara textos sin importar mayúsculas ni tildes ("ingenieria de sistemas" = "Ingeniería de Sistemas") */
export function claveTexto(texto: string): string {
  return normalizarEncabezado(texto).replace(/_/g, " ");
}

/** Convierte un campo a CSV con comillas cuando hace falta */
export function campoCSV(valor: string | number, separador: Separador = ";"): string {
  const texto = String(valor);
  return /["\r\n]/.test(texto) || texto.includes(separador) ? `"${texto.replace(/"/g, '""')}"` : texto;
}
