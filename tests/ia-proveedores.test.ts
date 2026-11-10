import { afterEach, describe, expect, it, vi } from "vitest";
import { ClienteGroq, aJsonSchema, aMensajes } from "@/lib/ia/groq";
import { ClienteGemini } from "@/lib/ia/gemini";
import { ModeloConRespaldo, PAUSA_TRAS_FALLA_MS, reiniciarPausas } from "@/lib/ia/respaldo";
import { modeloDesdeEntorno } from "@/lib/ia/proveedor";
import { ErrorIA, type ContenidoIA, type ModeloIA, type ParametrosGeneracion } from "@/lib/ia/tipos";
import { Agente } from "@/services/agente/Agente";
import { DECLARACIONES, type Herramientas } from "@/services/agente/declaraciones";

const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });
const texto = (t: string) => json({ choices: [{ message: { role: "assistant", content: t }, finish_reason: "stop" }] });
const llamada = (name: string, args: unknown) =>
  json({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "call_x", type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] });
const error = (estado: number, extra: Record<string, unknown> = {}) => json({ error: { message: "falla", type: "invalid_request_error", ...extra } }, estado);
const params: ParametrosGeneracion = { sistema: "S", contenidos: [{ role: "user", parts: [{ text: "hola" }] }] };
const cuerpoDe = (f: ReturnType<typeof vi.fn>, i: number) => JSON.parse(f.mock.calls[i][1].body);

describe("Groq: traducción al formato de chat completions", () => {
  it("los esquemas pasan a JSON Schema (tipos en minúscula, también anidados)", () => {
    expect(aJsonSchema({ type: "OBJECT", properties: { nivel: { type: "STRING", enum: ["ALTO"] }, n: { type: "INTEGER" } }, required: ["nivel"] })).toEqual({
      type: "object",
      properties: { nivel: { type: "string", enum: ["ALTO"] }, n: { type: "integer" } },
      required: ["nivel"],
    });
  });

  it("cada respuesta de función lleva el identificador de su llamada", () => {
    const contenidos: ContenidoIA[] = [
      { role: "user", parts: [{ text: "¿quiénes?" }] },
      { role: "model", parts: [{ functionCall: { name: "a", args: { x: 1 } } }, { functionCall: { name: "b" } }] },
      { role: "user", parts: [{ functionResponse: { name: "a", response: { ok: 1 } } }, { functionResponse: { name: "b", response: { ok: 2 } } }] },
      { role: "model", parts: [{ text: "listo" }] },
    ];
    const m = aMensajes("S", contenidos);
    expect(m[0]).toEqual({ role: "system", content: "S" });
    expect(m[1]).toEqual({ role: "user", content: "¿quiénes?" });
    const asistente = m[2] as { tool_calls: { id: string; function: { name: string; arguments: string } }[] };
    expect(asistente.tool_calls.map((t) => t.function.name)).toEqual(["a", "b"]);
    expect(JSON.parse(asistente.tool_calls[0].function.arguments)).toEqual({ x: 1 });
    expect(m[3]).toEqual({ role: "tool", tool_call_id: asistente.tool_calls[0].id, content: '{"ok":1}' });
    expect(m[4]).toEqual({ role: "tool", tool_call_id: asistente.tool_calls[1].id, content: '{"ok":2}' });
    expect(m[5]).toEqual({ role: "assistant", content: "listo" });
  });
});

describe("Cliente de Groq", () => {
  it("envía la clave como Bearer, las herramientas y pide no recibir el razonamiento", async () => {
    const fetch = vi.fn().mockResolvedValue(texto("Hola"));
    const partes = await new ClienteGroq("CLAVE", "openai/gpt-oss-120b", { fetch }).generar({ ...params, funciones: DECLARACIONES });
    expect(partes).toEqual([{ text: "Hola" }]);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer CLAVE");
    const cuerpo = cuerpoDe(fetch, 0);
    expect(cuerpo.model).toBe("openai/gpt-oss-120b");
    expect(cuerpo.include_reasoning).toBe(false);
    expect(cuerpo.tools).toHaveLength(DECLARACIONES.length);
    expect(cuerpo.tools[0]).toMatchObject({ type: "function", function: { name: "resumen_riesgo", parameters: { type: "object" } } });
  });

  it("las llamadas a función vuelven como partes del agente (argumentos ya interpretados)", async () => {
    const fetch = vi.fn().mockResolvedValue(llamada("detalle_estudiante", { codigo: "2026001" }));
    expect(await new ClienteGroq("K", undefined, { fetch }).generar(params)).toEqual([{ functionCall: { name: "detalle_estudiante", args: { codigo: "2026001" } } }]);
  });

  it("con un 503 espera y repite; con un 429 pasa al otro modelo sin esperar", async () => {
    const esperar = vi.fn().mockResolvedValue(undefined);
    const f503 = vi.fn().mockResolvedValueOnce(error(503)).mockResolvedValueOnce(texto("ok"));
    await new ClienteGroq("K", "openai/gpt-oss-120b", { fetch: f503, esperar }).generar(params);
    expect(esperar).toHaveBeenCalledOnce();
    expect(cuerpoDe(f503, 1).model).toBe("openai/gpt-oss-120b");

    const esperar2 = vi.fn();
    const f429 = vi.fn().mockResolvedValueOnce(error(429)).mockResolvedValueOnce(texto("ok"));
    const c = new ClienteGroq("K", "openai/gpt-oss-120b", { fetch: f429, esperar: esperar2 });
    await c.generar(params);
    expect(esperar2).not.toHaveBeenCalled();
    expect(cuerpoDe(f429, 1).model).toBe("openai/gpt-oss-20b");
    expect(c.nombreModelo).toBe("openai/gpt-oss-20b (Groq)");
  });

  it("una llamada a función mal escrita (failed_generation) se repite con otra temperatura", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(error(400, { code: "tool_use_failed", failed_generation: "<x>" })).mockResolvedValueOnce(texto("ok"));
    await new ClienteGroq("K", undefined, { fetch }).generar(params);
    expect(cuerpoDe(fetch, 1).temperature).toBeGreaterThan(cuerpoDe(fetch, 0).temperature);
  });

  it("una clave inválida no se reintenta y da un mensaje claro", async () => {
    const fetch = vi.fn().mockImplementation(async () => error(401));
    await expect(new ClienteGroq("K", undefined, { fetch }).generar(params)).rejects.toThrow(/GROQ_API_KEY/);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("si todos los modelos de Groq están saturados, se rinde con pocos intentos (para pasar al respaldo)", async () => {
    const fetch = vi.fn().mockImplementation(async () => error(503));
    await expect(new ClienteGroq("K", undefined, { fetch, esperar: async () => {} }).generar(params)).rejects.toMatchObject({ estado: 503 });
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("el agente completa el ciclo de herramientas con Groq", async () => {
    const herramientas: Herramientas = { declaraciones: DECLARACIONES, ejecutar: vi.fn().mockResolvedValue({ estudiantes: [{ codigo: "2026001", nivel: "ALTO" }] }) };
    const fetch = vi.fn().mockResolvedValueOnce(llamada("buscar_estudiantes", { nivel: "ALTO" })).mockResolvedValueOnce(texto("• 2026001 tiene riesgo alto."));
    const r = await new Agente(new ClienteGroq("K", undefined, { fetch }), herramientas).responder("¿Quiénes tienen riesgo alto?");
    expect(herramientas.ejecutar).toHaveBeenCalledWith("buscar_estudiantes", { nivel: "ALTO" });
    expect(r.codigos).toEqual(["2026001"]);
    expect(r.modelo).toBe("openai/gpt-oss-120b (Groq)");
    const segunda = cuerpoDe(fetch, 1).messages;
    expect(segunda.at(-1)).toMatchObject({ role: "tool", tool_call_id: segunda.at(-2).tool_calls[0].id });
  });
});

describe("Modelo con respaldo", () => {
  afterEach(() => reiniciarPausas());
  const modelo = (nombre: string, generar: ModeloIA["generar"]): ModeloIA => ({ nombreModelo: nombre, generar: vi.fn(generar) });

  it("si el principal falla, responde el respaldo y el principal queda en pausa un minuto", async () => {
    let ahora = 1_000;
    const principal = modelo("groq", async () => {
      throw new ErrorIA("saturado", 503);
    });
    const respaldo = modelo("gemini", async () => [{ text: "desde Gemini" }]);
    const m = new ModeloConRespaldo(principal, respaldo, "prueba", () => ahora);
    expect(await m.generar(params)).toEqual([{ text: "desde Gemini" }]);
    expect(m.nombreModelo).toBe("gemini");
    await m.generar(params);
    expect(principal.generar).toHaveBeenCalledTimes(1);
    ahora += PAUSA_TRAS_FALLA_MS + 1;
    await m.generar(params);
    expect(principal.generar).toHaveBeenCalledTimes(2);
  });

  it("si el principal responde, el respaldo no se usa", async () => {
    const respaldo = modelo("gemini", async () => [{ text: "no" }]);
    const m = new ModeloConRespaldo(modelo("groq", async () => [{ text: "sí" }]), respaldo, "prueba2");
    expect(await m.generar(params)).toEqual([{ text: "sí" }]);
    expect(respaldo.generar).not.toHaveBeenCalled();
    expect(m.nombreModelo).toBe("groq");
  });

  it("un bloqueo por filtros de seguridad (422) no se reenvía a otro proveedor", async () => {
    const respaldo = modelo("gemini", async () => [{ text: "no" }]);
    const m = new ModeloConRespaldo(
      modelo("groq", async () => {
        throw new ErrorIA("filtros", 422);
      }),
      respaldo,
      "prueba3",
    );
    await expect(m.generar(params)).rejects.toMatchObject({ estado: 422 });
    expect(respaldo.generar).not.toHaveBeenCalled();
  });
});

describe("Elección del proveedor según el entorno", () => {
  it("Groq con Gemini de respaldo, uno solo, o ninguno", () => {
    expect(modeloDesdeEntorno({ GROQ_API_KEY: "g", GEMINI_API_KEY: "m" })).toBeInstanceOf(ModeloConRespaldo);
    expect(modeloDesdeEntorno({ GROQ_API_KEY: "g" })).toBeInstanceOf(ClienteGroq);
    expect(modeloDesdeEntorno({ GEMINI_API_KEY: "m" })).toBeInstanceOf(ClienteGemini);
    expect(modeloDesdeEntorno({ GROQ_API_KEY: " ", GEMINI_API_KEY: "" })).toBeNull();
    expect(modeloDesdeEntorno({ GROQ_API_KEY: "g", GROQ_MODEL: "openai/gpt-oss-20b" })?.nombreModelo).toBe("openai/gpt-oss-20b (Groq)");
  });
});

describe("Gemini como respaldo a mitad de conversación", () => {
  it("las llamadas a función que hizo Groq (sin firma) se marcan para que Gemini las acepte", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ candidates: [{ content: { role: "model", parts: [{ text: "ok" }] } }] }));
    await new ClienteGemini("K", "gemini-x", { fetch }).generar({
      sistema: "S",
      contenidos: [
        { role: "user", parts: [{ text: "hola" }] },
        { role: "model", parts: [{ functionCall: { name: "resumen_riesgo" } }] },
        { role: "user", parts: [{ functionResponse: { name: "resumen_riesgo", response: {} } }] },
      ],
    });
    expect(cuerpoDe(fetch, 0).contents[1].parts[0].thoughtSignature).toBe("skip_thought_signature_validator");
  });
});
