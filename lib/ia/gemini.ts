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
  readonly type: "OBJECT" | "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN" | "ARRAY";
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly properties?: Readonly<Record<string, EsquemaGemini>>;
  readonly items?: EsquemaGemini;
  readonly required?: readonly string[];
}

export interface DeclaracionFuncion {
  readonly name: string;
  readonly description: string;
  readonly parameters?: EsquemaGemini;
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
/** Tiempo máximo de espera por cada llamada a Gemini (además, cada operación tiene un plazo total) */
const TIEMPO_MAXIMO_MS = 30_000;
/** Los modelos que «piensan» descuentan el razonamiento de este límite: se deja margen para el texto */
const MAX_TOKENS_RESPUESTA = 4096;
/**
 * Plazo total de una operación con IA (todas sus llamadas). Las rutas tienen 60 s (maxDuration):
 * se deja margen para responder un error claro en vez de que la plataforma corte la función.
 */
export const PLAZO_TOTAL_MS = 50_000;
/** Temperatura baja: respuestas sobrias y apegadas a los datos */
const TEMPERATURA_POR_DEFECTO = 0.2;

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

  /**
   * Hace la petición y lee el cuerpo DENTRO del mismo tiempo de espera (antes el temporizador se
   * cancelaba al llegar los encabezados y un cuerpo que no terminaba de llegar colgaba la petición).
   * El tiempo de cada llamada nunca pasa del plazo total de la operación.
   */
  private async llamar(url: string, init: RequestInit, plazo: number): Promise<{ ok: boolean; estado: number; cuerpo: unknown }> {
    const restante = Math.min(TIEMPO_MAXIMO_MS, plazo - Date.now());
    if (restante <= 0) throw new ErrorIA("Gemini tardó demasiado en responder. Intenta con una pregunta más concreta.", 504);
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), restante);
    try {
      const r = await this.fetch(url, { ...init, signal: control.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey, ...(init.headers ?? {}) } });
      const texto = await r.text();
      let cuerpo: unknown = null;
      try {
        cuerpo = texto ? JSON.parse(texto) : null;
      } catch {
        // Un proxy o una página de error en HTML: si la respuesta era «correcta», no se puede usar
        if (r.ok) throw new ErrorIA("Gemini devolvió una respuesta que no se pudo leer. Intenta de nuevo.", 502);
      }
      return { ok: r.ok, estado: r.status, cuerpo };
    } catch (e) {
      if (e instanceof ErrorIA) throw e;
      throw new ErrorIA(control.signal.aborted ? "Gemini tardó demasiado en responder. Intenta de nuevo en un momento." : "No fue posible comunicarse con Gemini. Intenta de nuevo en un momento.", 504);
    } finally {
      clearTimeout(temporizador);
    }
  }

  private async resolverModelo(plazo: number): Promise<string | null> {
    const r = await this.llamar(`${API}/models?pageSize=200`, { method: "GET" }, plazo);
    if (!r.ok) return null;
    const datos = r.cuerpo as { models?: { name: string; supportedGenerationMethods?: string[] }[] } | null;
    return elegirModelo(datos?.models ?? []);
  }

  /**
   * @param params.plazo momento (ms desde epoch) en que debe terminar la operación completa; por
   *   defecto, PLAZO_TOTAL_MS desde ahora. El agente pasa el mismo plazo a todas sus rondas.
   */
  async generar(params: { sistema: string; contenidos: ContenidoGemini[]; funciones?: readonly DeclaracionFuncion[]; temperatura?: number; plazo?: number }): Promise<ParteGemini[]> {
    const plazo = params.plazo ?? Date.now() + PLAZO_TOTAL_MS;
    const cuerpo = JSON.stringify({
      systemInstruction: { parts: [{ text: params.sistema }] },
      contents: params.contenidos,
      ...(params.funciones?.length ? { tools: [{ functionDeclarations: params.funciones }] } : {}),
      generationConfig: { temperature: params.temperatura ?? TEMPERATURA_POR_DEFECTO, maxOutputTokens: MAX_TOKENS_RESPUESTA },
    });

    for (let intento = 0; intento < 2; intento++) {
      const r = await this.llamar(`${API}/models/${encodeURIComponent(this.modelo)}:generateContent`, { method: "POST", body: cuerpo }, plazo);
      if (r.estado === 404 && intento === 0) {
        const otro = await this.resolverModelo(plazo);
        if (otro && otro !== this.modelo) {
          this.modelo = otro;
          modeloResuelto = otro;
          continue;
        }
      }
      if (!r.ok) throw errorDeRespuesta(r.estado, r.cuerpo);
      const datos = (r.cuerpo ?? {}) as { candidates?: { content?: { parts?: ParteGemini[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
      if (datos.promptFeedback?.blockReason) throw new ErrorIA("Gemini no respondió a esta consulta por sus filtros de seguridad. Reformula la pregunta.", 422);
      const candidato = datos.candidates?.[0];
      // Una respuesta cortada se mostraría (y la explicación se guardaría) como si estuviera completa
      if (candidato?.finishReason === "MAX_TOKENS") throw new ErrorIA("La respuesta de Gemini quedó incompleta. Intenta con una pregunta más concreta.", 502);
      if (candidato?.finishReason === "SAFETY" || candidato?.finishReason === "RECITATION") throw new ErrorIA("Gemini no completó la respuesta por sus filtros de seguridad. Reformula la pregunta.", 422);
      const partes = candidato?.content?.parts ?? [];
      if (partes.length === 0) throw new ErrorIA("Gemini devolvió una respuesta vacía. Intenta de nuevo.", 502);
      return partes;
    }
    throw new ErrorIA("No se encontró un modelo de Gemini disponible para esta clave.", 502);
  }
}

/**
 * Error claro para cada respuesta fallida de Gemini. Solo se culpa a la clave con 401/403 o cuando
 * Gemini lo dice (razón API_KEY_INVALID): un 400 INVALID_ARGUMENT también puede ser un mensaje
 * demasiado largo o una función mal declarada, y decir «la clave no es válida» confundía.
 */
export function errorDeRespuesta(estado: number, cuerpo: unknown): ErrorIA {
  const error = (cuerpo as { error?: { message?: string; details?: { reason?: string }[] } } | null)?.error;
  const mencionaClave = Boolean(error?.details?.some((d) => d.reason?.startsWith("API_KEY")) || /api key/i.test(error?.message ?? ""));
  if (estado === 401 || estado === 403 || (estado === 400 && mencionaClave)) return new ErrorIA("La clave de Gemini (GEMINI_API_KEY) no es válida o le faltan permisos.", 502);
  if (estado === 429) return new ErrorIA("Se alcanzó el límite de consultas gratuitas de Gemini. Espera un minuto e inténtalo de nuevo.", 429);
  if (estado === 404) return new ErrorIA("El modelo de Gemini configurado no existe. Revisa GEMINI_MODEL.", 502);
  if (estado === 400) return new ErrorIA("Gemini no aceptó la consulta (puede ser demasiado larga). Intenta con una pregunta más corta.", 502);
  return new ErrorIA(`Gemini respondió con un error (${estado}). Intenta de nuevo en un momento.`, 502);
}

/** Texto de la respuesta (une las partes de texto) */
export function textoDe(partes: ParteGemini[]): string {
  return partes
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}
