import { describe, expect, it, vi } from "vitest";
import { ClienteGemini, ErrorIA, elegirModelo, type ParteGemini } from "@/lib/ia/gemini";
import { Agente, codigosMencionados, sistemaAgente } from "@/services/agente/Agente";
import { accionesSugeridas, explicacionBasica, promptExplicacion, type EntradaExplicacion } from "@/services/agente/explicacion";
import { DECLARACIONES, type Herramientas } from "@/services/agente/declaraciones";

const respuesta = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { "Content-Type": "application/json" } });
const candidato = (parts: ParteGemini[]) => respuesta({ candidates: [{ content: { role: "model", parts } }] });

describe("Cliente de Gemini", () => {
  it("envía la clave en la cabecera, el sistema y las funciones", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(candidato([{ text: "Hola" }]));
    const c = new ClienteGemini("CLAVE", "gemini-x", { fetch: fetchFalso });
    const partes = await c.generar({ sistema: "S", contenidos: [{ role: "user", parts: [{ text: "hola" }] }], funciones: DECLARACIONES });
    expect(partes).toEqual([{ text: "Hola" }]);
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("CLAVE");
    expect(String(url)).not.toContain("CLAVE");
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.systemInstruction.parts[0].text).toBe("S");
    expect(cuerpo.tools[0].functionDeclarations.map((f: { name: string }) => f.name)).toEqual(["resumen_riesgo", "buscar_estudiantes", "detalle_estudiante", "cifras_oficiales_ucc"]);
  });

  it("si el modelo no existe, consulta la lista y usa un Flash disponible", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuesta({ error: { status: "NOT_FOUND" } }, 404))
      .mockResolvedValueOnce(respuesta({ models: [{ name: "models/gemini-9-flash", supportedGenerationMethods: ["generateContent"] }] }))
      .mockResolvedValueOnce(candidato([{ text: "ok" }]));
    const c = new ClienteGemini("K", "no-existe", { fetch: fetchFalso });
    await c.generar({ sistema: "S", contenidos: [] });
    expect(c.nombreModelo).toBe("gemini-9-flash");
    expect(fetchFalso.mock.calls[2][0]).toContain("/models/gemini-9-flash:generateContent");
  });

  it("traduce los errores de cuota y de clave a mensajes claros", async () => {
    const c429 = new ClienteGemini("K", "m", { fetch: vi.fn().mockResolvedValue(respuesta({ error: { status: "RESOURCE_EXHAUSTED" } }, 429)) });
    await expect(c429.generar({ sistema: "S", contenidos: [] })).rejects.toThrow(/límite de consultas gratuitas/);
    const c400 = new ClienteGemini("K", "m", { fetch: vi.fn().mockResolvedValue(respuesta({ error: { status: "INVALID_ARGUMENT", message: "API key not valid" } }, 400)) });
    await expect(c400.generar({ sistema: "S", contenidos: [] })).rejects.toBeInstanceOf(ErrorIA);
  });

  it("elige un Flash estable antes que uno preview, lite o de imagen", () => {
    const m = (name: string) => ({ name: `models/${name}`, supportedGenerationMethods: ["generateContent"] });
    expect(elegirModelo([m("gemini-3-flash-preview"), m("gemini-2.5-flash-image"), m("gemini-2.5-flash-lite"), m("gemini-2.5-flash"), m("gemini-2.5-pro")])).toBe("gemini-2.5-flash");
    expect(elegirModelo([m("gemini-2.5-pro")])).toBeNull();
  });
});

describe("Agente con llamadas a funciones", () => {
  it("consulta las herramientas, devuelve el resultado a Gemini y responde con los códigos mencionados", async () => {
    const herramientas: Herramientas = {
      ejecutar: vi.fn().mockResolvedValue({ total: 1, estudiantes: [{ codigo: "A001", programa: "Derecho", nivel: "ALTO", puntaje: 70, factores: ["Promedio acumulado bajo"] }] }),
    };
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(candidato([{ functionCall: { name: "buscar_estudiantes", args: { nivel: "ALTO" } }, thoughtSignature: "firma" }]))
      .mockResolvedValueOnce(candidato([{ text: "El estudiante A001 de Derecho tiene riesgo alto por su promedio." }]));
    const r = await new Agente(new ClienteGemini("K", "m", { fetch: fetchFalso }), herramientas).responder("¿Quiénes tienen riesgo alto?");

    expect(herramientas.ejecutar).toHaveBeenCalledWith("buscar_estudiantes", { nivel: "ALTO" });
    expect(r.respuesta).toContain("A001");
    expect(r.codigos).toEqual(["A001"]);
    expect(r.herramientas).toEqual(["buscar_estudiantes"]);
    // Segunda llamada: incluye el turno del modelo (con su firma) y la respuesta de la función
    const segunda = JSON.parse(fetchFalso.mock.calls[1][1].body);
    expect(segunda.contents[1]).toEqual({ role: "model", parts: [{ functionCall: { name: "buscar_estudiantes", args: { nivel: "ALTO" } }, thoughtSignature: "firma" }] });
    expect(segunda.contents[2].parts[0].functionResponse.name).toBe("buscar_estudiantes");
  });

  it("no enlaza códigos que no vinieron de las herramientas (no se inventan estudiantes)", () => {
    expect(codigosMencionados("Revisa a A001 y a Z999.", new Set(["A001"]))).toEqual(["A001"]);
  });

  it("si una herramienta falla, el agente recibe un error controlado y sigue", async () => {
    const herramientas: Herramientas = { ejecutar: vi.fn().mockRejectedValue(new Error("BD caída")) };
    const fetchFalso = vi.fn().mockResolvedValueOnce(candidato([{ functionCall: { name: "resumen_riesgo" } }])).mockResolvedValueOnce(candidato([{ text: "No pude consultar los datos." }]));
    const espiaConsola = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await new Agente(new ClienteGemini("K", "m", { fetch: fetchFalso }), herramientas).responder("resumen");
    espiaConsola.mockRestore();
    expect(r.respuesta).toBe("No pude consultar los datos.");
    expect(JSON.parse(fetchFalso.mock.calls[1][1].body).contents[2].parts[0].functionResponse.response).toEqual({ error: "No se pudo consultar esta información." });
  });

  it("las instrucciones prohíben inventar datos y protegen los nombres", () => {
    const s = sistemaAgente(new Date("2026-10-19T15:00:00Z"));
    expect(s).toContain("nunca inventes");
    expect(s).toContain("Ley 1581");
    expect(s).toContain("19 de octubre de 2026");
  });
});

describe("Explicación del riesgo", () => {
  const entrada: EntradaExplicacion = {
    programa: "Derecho",
    datos: { semestre: 2, promedio: 2.7, materiasPerdidas: 2, moraMatricula: true },
    puntaje: 68,
    nivel: "ALTO",
    metodo: "FACTORES",
    factores: [
      { clave: "promedio", etiqueta: "Promedio acumulado bajo", puntos: 25, detalle: "Promedio de 2,7, por debajo de la nota aprobatoria (3,0)." },
      { clave: "materiasPerdidas", etiqueta: "Materias perdidas", puntos: 20, detalle: "Perdió 2 materias en el último periodo." },
      { clave: "moraMatricula", etiqueta: "Pagos de matrícula pendientes", puntos: 15, detalle: "Tiene pagos de matrícula pendientes." },
    ],
    faltantes: ["asistencia", "puntajeSaber11"],
  };

  it("la explicación básica lista los factores, acciones y datos faltantes", () => {
    const t = explicacionBasica(entrada);
    expect(t).toContain("Riesgo alto (68/100)");
    expect(t).toContain("Perdió 2 materias");
    expect(t).toContain("acuerdos de pago");
    expect(t).toContain("asistencia");
  });

  it("al agente nunca se le envían nombre ni código", () => {
    const p = promptExplicacion(entrada);
    expect(p).toContain("Promedio acumulado: 2,7");
    expect(p).not.toMatch(/nombre|código/i);
  });

  it("acciones sin repetir y como máximo 3", () => {
    expect(accionesSugeridas(entrada.factores)).toHaveLength(3);
    expect(new Set(accionesSugeridas([...entrada.factores, ...entrada.factores], 10)).size).toBe(3);
  });
});
