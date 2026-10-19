/**
 * Cliente mínimo de la API de Google Gemini (REST, sin dependencias).
 *
 *   GEMINI_API_KEY  clave creada en Google AI Studio (https://aistudio.google.com/apikey)
 *   GEMINI_MODEL    opcional; por defecto "gemini-flash-latest" (alias que Google mantiene apuntando
 *                   al modelo Flash vigente). Si el modelo no existe, el cliente consulta la lista de
 *                   modelos de la cuenta y elige un Flash disponible.
 *
 * Privacidad: a Gemini solo se envían datos académicos SIN nombre ni documento (ver services/agente).
 */

export interface ParteGemini {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  /** Firma que algunos modelos exigen recibir de vuelta junto a la llamada a función */
  thoughtSignature?: string;
}

export interface ContenidoGemini {
  role: "user" | "model";
  parts: ParteGemini[];
}

/** Esquema de parámetros (subconjunto de OpenAPI que acepta Gemini) */
export interface EsquemaGemini {
  type: "OBJECT" | "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN" | "ARRAY";
  description?: string;
  enum?: string[];
  properties?: Record<string, EsquemaGemini>;
  items?: EsquemaGemini;
  required?: string[];
}

export interface DeclaracionFuncion {
  name: string;
  description: string;
  parameters?: EsquemaGemini;
}

export class ErrorIA extends Error {
  constructor(
    mensaje: string,
    public readonly estado: number = 502,
  ) {
    super(mensaje);
    this.name = "ErrorIA";
  }
}

export const MODELO_POR_DEFECTO = "gemini-flash-latest";
const API = "https://generativelanguage.googleapis.com/v1beta";

type Fetch = typeof fetch;

/** Modelo resuelto en esta instancia del servidor (se reutiliza entre peticiones) */
let modeloResuelto: string | null = null;

/** Entre los modelos de la cuenta, prefiere un Flash estable que genere texto */
export function elegirModelo(modelos: { name: string; supportedGenerationMethods?: string[] }[]): string | null {
  const candidatos = modelos
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => n.includes("flash") && !/(image|tts|audio|live|embedding|thinking)/.test(n));
  const puntuar = (n: string) => (n.includes("preview") || n.includes("exp") ? 2 : 0) + (n.includes("lite") ? 1 : 0);
  candidatos.sort((a, b) => puntuar(a) - puntuar(b) || b.localeCompare(a, "en", { numeric: true }));
  return candidatos[0] ?? null;
}

export class ClienteGemini {
  private readonly fetch: Fetch;

  constructor(
    private readonly apiKey: string,
    private modelo: string = MODELO_POR_DEFECTO,
    opciones: { fetch?: Fetch } = {},
  ) {
    this.fetch = opciones.fetch ?? fetch;
  }

  /** null si no hay clave configurada (la aplicación sigue funcionando sin el agente) */
  static desdeEntorno(): ClienteGemini | null {
    const clave = process.env.GEMINI_API_KEY?.trim();
    if (!clave) return null;
    return new ClienteGemini(clave, process.env.GEMINI_MODEL?.trim() || modeloResuelto || MODELO_POR_DEFECTO);
  }

  get nombreModelo(): string {
    return this.modelo;
  }

  private async llamar(url: string, init: RequestInit): Promise<Response> {
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), 30_000);
    try {
      return await this.fetch(url, { ...init, signal: control.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey, ...(init.headers ?? {}) } });
    } catch {
      throw new ErrorIA("No fue posible comunicarse con Gemini. Intenta de nuevo en un momento.", 504);
    } finally {
      clearTimeout(temporizador);
    }
  }

  private async resolverModelo(): Promise<string | null> {
    const r = await this.llamar(`${API}/models?pageSize=200`, { method: "GET" });
    if (!r.ok) return null;
    const datos = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return elegirModelo(datos.models ?? []);
  }

  async generar(params: { sistema: string; contenidos: ContenidoGemini[]; funciones?: DeclaracionFuncion[]; temperatura?: number }): Promise<ParteGemini[]> {
    const cuerpo = JSON.stringify({
      systemInstruction: { parts: [{ text: params.sistema }] },
      contents: params.contenidos,
      ...(params.funciones?.length ? { tools: [{ functionDeclarations: params.funciones }] } : {}),
      generationConfig: { temperature: params.temperatura ?? 0.2, maxOutputTokens: 2048 },
    });

    for (let intento = 0; intento < 2; intento++) {
      const r = await this.llamar(`${API}/models/${encodeURIComponent(this.modelo)}:generateContent`, { method: "POST", body: cuerpo });
      if (r.status === 404 && intento === 0) {
        const otro = await this.resolverModelo();
        if (otro && otro !== this.modelo) {
          this.modelo = otro;
          modeloResuelto = otro;
          continue;
        }
      }
      if (!r.ok) throw await errorDeRespuesta(r);
      const datos = (await r.json()) as { candidates?: { content?: { parts?: ParteGemini[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
      if (datos.promptFeedback?.blockReason) throw new ErrorIA("Gemini no respondió a esta consulta por sus filtros de seguridad. Reformula la pregunta.", 422);
      const partes = datos.candidates?.[0]?.content?.parts ?? [];
      if (partes.length === 0) throw new ErrorIA("Gemini devolvió una respuesta vacía. Intenta de nuevo.", 502);
      return partes;
    }
    throw new ErrorIA("No se encontró un modelo de Gemini disponible para esta clave.", 502);
  }
}

async function errorDeRespuesta(r: Response): Promise<ErrorIA> {
  let detalle = "";
  try {
    const j = (await r.json()) as { error?: { message?: string; status?: string } };
    detalle = j.error?.status ?? "";
  } catch {
    /* sin cuerpo */
  }
  if (r.status === 400 && /API_KEY|INVALID_ARGUMENT/.test(detalle)) return new ErrorIA("La clave de Gemini (GEMINI_API_KEY) no es válida o le faltan permisos.", 502);
  if (r.status === 401 || r.status === 403) return new ErrorIA("La clave de Gemini (GEMINI_API_KEY) no es válida o le faltan permisos.", 502);
  if (r.status === 429) return new ErrorIA("Se alcanzó el límite de consultas gratuitas de Gemini. Espera un minuto e inténtalo de nuevo.", 429);
  if (r.status === 404) return new ErrorIA("El modelo de Gemini configurado no existe. Revisa GEMINI_MODEL.", 502);
  return new ErrorIA(`Gemini respondió con un error (${r.status}). Intenta de nuevo en un momento.`, 502);
}

/** Texto de la respuesta (une las partes de texto) */
export function textoDe(partes: ParteGemini[]): string {
  return partes
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
