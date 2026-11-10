/**
 * Contrato común de los proveedores de IA del agente (Groq y Google Gemini).
 *
 * La conversación se representa con «partes» (texto, llamada a función y respuesta de función),
 * el formato que el agente ya usaba. Cada cliente traduce este formato al de su API, así el agente,
 * las herramientas y la explicación no dependen de ningún proveedor (principio de inversión de
 * dependencias): cambiar de proveedor o agregar uno de respaldo no toca services/agente.
 *
 * Privacidad: a ningún proveedor se le envían nombres ni documentos (ver services/agente).
 */

export interface ParteIA {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  /** Firma de razonamiento que Gemini exige recibir de vuelta junto a su llamada a función */
  thoughtSignature?: string;
}

export interface ContenidoIA {
  role: "user" | "model";
  parts: ParteIA[];
}

/** Esquema de parámetros de una función (subconjunto de OpenAPI; cada cliente lo adapta a su API) */
export interface EsquemaFuncion {
  readonly type: "OBJECT" | "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN" | "ARRAY";
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly properties?: Readonly<Record<string, EsquemaFuncion>>;
  readonly items?: EsquemaFuncion;
  readonly required?: readonly string[];
}

export interface DeclaracionFuncion {
  readonly name: string;
  readonly description: string;
  readonly parameters?: EsquemaFuncion;
}

export interface ParametrosGeneracion {
  sistema: string;
  contenidos: ContenidoIA[];
  funciones?: readonly DeclaracionFuncion[];
  temperatura?: number;
  /** Momento (ms desde epoch) en que debe terminar la operación completa (todas sus rondas) */
  plazo?: number;
}

/** Lo que el agente necesita de un modelo de lenguaje, sea cual sea el proveedor */
export interface ModeloIA {
  /** Modelo que respondió la última consulta (se guarda junto a la explicación) */
  readonly nombreModelo: string;
  generar(params: ParametrosGeneracion): Promise<ParteIA[]>;
}

/** Falla de un proveedor de IA, con el estado HTTP que verá el usuario */
export class ErrorIA extends Error {
  constructor(
    mensaje: string,
    public readonly estado: number = 502,
  ) {
    super(mensaje);
    this.name = "ErrorIA";
  }
}

/**
 * Plazo total de una operación con IA (todas sus llamadas). Las rutas tienen 60 s (maxDuration):
 * se deja margen para responder un error claro en vez de que la plataforma corte la función.
 */
export const PLAZO_TOTAL_MS = 50_000;
/** Los modelos que razonan descuentan el razonamiento de este límite: se deja margen para el texto */
export const MAX_TOKENS_RESPUESTA = 4096;
/** Temperatura baja: respuestas sobrias y apegadas a los datos */
export const TEMPERATURA_POR_DEFECTO = 0.2;

/** Texto de la respuesta (une las partes de texto) */
export function textoDe(partes: ParteIA[]): string {
  return partes
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export type Esperar = (ms: number) => Promise<void>;
export const esperarReal: Esperar = (ms) => new Promise((r) => setTimeout(r, ms));
