import {
  ErrorIA,
  MAX_TOKENS_RESPUESTA,
  PLAZO_TOTAL_MS,
  TEMPERATURA_POR_DEFECTO,
  esperarReal,
  type ContenidoIA,
  type DeclaracionFuncion,
  type EsquemaFuncion,
  type Esperar,
  type ModeloIA,
  type ParametrosGeneracion,
  type ParteIA,
} from "./tipos";

/**
 * Cliente de Groq (API compatible con OpenAI, REST, sin dependencias). Implementa ModeloIA.
 *
 *   GROQ_API_KEY  clave creada en https://console.groq.com/keys (plan gratuito, sin tarjeta)
 *   GROQ_MODEL    opcional; por defecto "openai/gpt-oss-120b"
 *
 * Traduce la conversación del agente (partes de texto, llamadas y respuestas de funciones) a los
 * mensajes de chat completions: `tool_calls` del asistente y mensajes `role: "tool"`.
 * Privacidad: igual que con Gemini, solo viajan datos académicos SIN nombre ni documento.
 */
export const MODELO_GROQ_POR_DEFECTO = "openai/gpt-oss-120b";
/** Si el modelo configurado está saturado, sin cuota o ya no existe, se prueba con estos (en orden) */
const MODELOS_GROQ_ALTERNOS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const API = "https://api.groq.com/openai/v1/chat/completions";
const TIEMPO_MAXIMO_MS = 30_000;
const MAX_INTENTOS = 4;
const ESPERA_REINTENTO_MS = 1_000;
/** 498: capacidad del nivel «flex» agotada; 5xx: servidores saturados o caídos */
const SATURADO = new Set([498, 500, 502, 503, 504]);

type Fetch = typeof fetch;

/** Mensaje de chat completions (solo los campos que se usan) */
export type MensajeGroq =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: LlamadaGroq[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface LlamadaGroq {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface RespuestaGroq {
  choices?: { message?: { content?: string | null; tool_calls?: LlamadaGroq[] }; finish_reason?: string }[];
}

/** Esquema del agente (tipos en mayúscula, estilo Gemini) a JSON Schema (tipos en minúscula) */
export function aJsonSchema(e: EsquemaFuncion): Record<string, unknown> {
  return {
    type: e.type.toLowerCase(),
    ...(e.description ? { description: e.description } : {}),
    ...(e.enum ? { enum: [...e.enum] } : {}),
    ...(e.properties ? { properties: Object.fromEntries(Object.entries(e.properties).map(([k, v]) => [k, aJsonSchema(v)])) } : {}),
    ...(e.items ? { items: aJsonSchema(e.items) } : {}),
    ...(e.required ? { required: [...e.required] } : {}),
  };
}

export function aHerramientas(funciones: readonly DeclaracionFuncion[]) {
  return funciones.map((f) => ({
    type: "function" as const,
    function: { name: f.name, description: f.description, parameters: f.parameters ? aJsonSchema(f.parameters) : { type: "object", properties: {} } },
  }));
}

/**
 * Conversación del agente a mensajes de chat. Las partes no guardan el identificador de cada llamada:
 * se asigna uno por posición (turno y orden), y las respuestas del turno siguiente, que el agente
 * envía en el mismo orden que las llamadas, reciben el mismo identificador.
 */
export function aMensajes(sistema: string, contenidos: ContenidoIA[]): MensajeGroq[] {
  const mensajes: MensajeGroq[] = [{ role: "system", content: sistema }];
  let pendientes: string[] = [];
  contenidos.forEach((c, turno) => {
    const texto = c.parts.map((p) => p.text ?? "").join("");
    if (c.role === "model") {
      const llamadas = c.parts.filter((p) => p.functionCall);
      pendientes = llamadas.map((_, i) => `llamada_${turno}_${i}`);
      mensajes.push({
        role: "assistant",
        content: texto || null,
        ...(llamadas.length
          ? { tool_calls: llamadas.map((p, i) => ({ id: pendientes[i], type: "function" as const, function: { name: p.functionCall!.name, arguments: JSON.stringify(p.functionCall!.args ?? {}) } })) }
          : {}),
      });
      return;
    }
    const respuestas = c.parts.filter((p) => p.functionResponse);
    respuestas.forEach((p, i) => mensajes.push({ role: "tool", tool_call_id: pendientes[i] ?? `llamada_${turno}_${i}`, content: JSON.stringify(p.functionResponse!.response) }));
    if (texto) mensajes.push({ role: "user", content: texto });
    if (respuestas.length) pendientes = [];
  });
  return mensajes;
}

function argumentosDe(texto: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(texto || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Respuesta de chat completions a partes del agente */
export function partesDeGroq(cuerpo: unknown): ParteIA[] {
  const opcion = (cuerpo as RespuestaGroq | null)?.choices?.[0];
  if (opcion?.finish_reason === "length") throw new ErrorIA("La respuesta de la IA quedó incompleta. Intenta con una pregunta más concreta.", 502);
  if (opcion?.finish_reason === "content_filter") throw new ErrorIA("La IA no completó la respuesta por sus filtros de seguridad. Reformula la pregunta.", 422);
  const mensaje = opcion?.message;
  const partes: ParteIA[] = [];
  if (mensaje?.content?.trim()) partes.push({ text: mensaje.content });
  for (const l of mensaje?.tool_calls ?? []) partes.push({ functionCall: { name: l.function.name, args: argumentosDe(l.function.arguments) } });
  if (partes.length === 0) throw new ErrorIA("La IA devolvió una respuesta vacía. Intenta de nuevo.", 502);
  return partes;
}

export function errorDeGroq(estado: number, cuerpo: unknown): ErrorIA {
  const mensaje = (cuerpo as { error?: { message?: string } } | null)?.error?.message ?? "";
  if (estado === 401 || estado === 403) return new ErrorIA("La clave de Groq (GROQ_API_KEY) no es válida o le faltan permisos.", 502);
  if (estado === 429) return new ErrorIA("Se alcanzó el límite de consultas gratuitas de la IA. Espera un minuto e inténtalo de nuevo.", 429);
  if (estado === 404) return new ErrorIA("El modelo de Groq configurado no existe. Revisa GROQ_MODEL.", 502);
  if (estado === 413 || /context|too long|maximum/i.test(mensaje)) return new ErrorIA("La consulta es demasiado larga para la IA. Intenta con una pregunta más corta.", 502);
  if (SATURADO.has(estado)) return new ErrorIA("Los servidores de la IA están saturados en este momento. Intenta de nuevo en unos segundos.", 503);
  if (estado === 400) return new ErrorIA("La IA no pudo procesar la consulta. Intenta reformularla.", 502);
  return new ErrorIA(`La IA respondió con un error (${estado}). Intenta de nuevo en un momento.`, 502);
}

/** Un 400 con «failed_generation»: el modelo escribió mal una llamada a función (suele pasar al repetir) */
function generacionFallida(estado: number, cuerpo: unknown): boolean {
  const error = (cuerpo as { error?: { code?: string; failed_generation?: unknown } } | null)?.error;
  return estado === 400 && (error?.code === "tool_use_failed" || error?.failed_generation !== undefined);
}

export class ClienteGroq implements ModeloIA {
  private readonly fetch: Fetch;
  private readonly esperar: Esperar;

  constructor(
    private readonly apiKey: string,
    private modelo: string = MODELO_GROQ_POR_DEFECTO,
    opciones: { fetch?: Fetch; esperar?: Esperar } = {},
  ) {
    this.fetch = opciones.fetch ?? fetch;
    this.esperar = opciones.esperar ?? esperarReal;
  }

  get nombreModelo(): string {
    return `${this.modelo} (Groq)`;
  }

  private cuerpo(params: ParametrosGeneracion, temperatura: number): string {
    const razona = this.modelo.startsWith("openai/gpt-oss");
    return JSON.stringify({
      model: this.modelo,
      messages: aMensajes(params.sistema, params.contenidos),
      temperature: temperatura,
      max_completion_tokens: MAX_TOKENS_RESPUESTA,
      // El razonamiento interno no se muestra: no hace falta recibirlo
      ...(razona ? { include_reasoning: false } : {}),
      ...(params.funciones?.length ? { tools: aHerramientas(params.funciones), tool_choice: "auto" } : {}),
    });
  }

  /** Petición y lectura del cuerpo dentro del mismo tiempo de espera, sin pasar del plazo total */
  private async llamar(cuerpo: string, plazo: number): Promise<{ ok: boolean; estado: number; cuerpo: unknown }> {
    const restante = Math.min(TIEMPO_MAXIMO_MS, plazo - Date.now());
    if (restante <= 0) throw new ErrorIA("La IA tardó demasiado en responder. Intenta con una pregunta más concreta.", 504);
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), restante);
    try {
      const r = await this.fetch(API, { method: "POST", body: cuerpo, signal: control.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` } });
      const texto = await r.text();
      let datos: unknown = null;
      try {
        datos = texto ? JSON.parse(texto) : null;
      } catch {
        if (r.ok) throw new ErrorIA("La IA devolvió una respuesta que no se pudo leer. Intenta de nuevo.", 502);
      }
      return { ok: r.ok, estado: r.status, cuerpo: datos };
    } catch (e) {
      if (e instanceof ErrorIA) throw e;
      throw new ErrorIA(control.signal.aborted ? "La IA tardó demasiado en responder. Intenta de nuevo en un momento." : "No fue posible comunicarse con Groq. Intenta de nuevo en un momento.", 504);
    } finally {
      clearTimeout(temporizador);
    }
  }

  /**
   * Con el servidor saturado repite una vez tras una espera corta; con la cuota agotada (es por
   * modelo) o un modelo retirado pasa al siguiente modelo; con una llamada a función mal escrita
   * repite con otra temperatura. Si nada funciona lanza el error, y el respaldo (Gemini) toma el turno.
   */
  async generar(params: ParametrosGeneracion): Promise<ParteIA[]> {
    const plazo = params.plazo ?? Date.now() + PLAZO_TOTAL_MS;
    let temperatura = params.temperatura ?? TEMPERATURA_POR_DEFECTO;
    const probados = new Set<string>();
    let fallasEnModelo = 0;
    let ultimoError: ErrorIA | null = null;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const r = await this.llamar(this.cuerpo(params, temperatura), plazo);
      if (r.ok) return partesDeGroq(r.cuerpo);
      ultimoError = errorDeGroq(r.estado, r.cuerpo);
      fallasEnModelo++;

      if (generacionFallida(r.estado, r.cuerpo) && fallasEnModelo === 1) {
        temperatura = Math.min(1, temperatura + 0.4);
        continue;
      }
      if (SATURADO.has(r.estado) && fallasEnModelo === 1 && plazo - Date.now() > ESPERA_REINTENTO_MS * 3) {
        await this.esperar(ESPERA_REINTENTO_MS);
        continue;
      }
      if (!SATURADO.has(r.estado) && r.estado !== 429 && r.estado !== 404) break;
      probados.add(this.modelo);
      const otro = MODELOS_GROQ_ALTERNOS.find((m) => !probados.has(m));
      if (!otro) break;
      console.warn(`[groq] ${this.modelo} no está disponible (${r.estado}); se usa ${otro}`);
      this.modelo = otro;
      fallasEnModelo = 0;
    }
    throw ultimoError ?? new ErrorIA("La IA no está disponible en este momento.", 503);
  }
}
