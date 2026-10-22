import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ErrorApi } from "@/lib/errores";
import { LIMITE_JSON_BYTES, leerJson, leerTextoAcotado } from "@/lib/cuerpo";

/** Petición con el cuerpo enviado por partes (sin Content-Length) */
const porPartes = (texto: string) =>
  new Request("http://x/api", { method: "POST", body: new Blob([texto]).stream(), duplex: "half" } as RequestInit & { duplex: "half" });

describe("cuerpo de las peticiones", () => {
  it("lee un JSON normal y lo valida", async () => {
    const req = new Request("http://x/api", { method: "POST", body: JSON.stringify({ pregunta: "hola" }) });
    expect(await leerJson(req, z.object({ pregunta: z.string() }))).toEqual({ pregunta: "hola" });
  });

  it("rechaza con 413 un cuerpo grande aunque no declare su tamaño", async () => {
    await expect(leerTextoAcotado(porPartes("x".repeat(LIMITE_JSON_BYTES + 1)), LIMITE_JSON_BYTES)).rejects.toMatchObject({ estado: 413 });
  });

  it("rechaza con 413 por el tamaño declarado sin leer el cuerpo", async () => {
    const req = new Request("http://x/api", { method: "POST", body: "{}", headers: { "content-length": String(LIMITE_JSON_BYTES * 10) } });
    await expect(leerTextoAcotado(req, LIMITE_JSON_BYTES)).rejects.toBeInstanceOf(ErrorApi);
  });

  it("un JSON mal formado es 400, no 500", async () => {
    await expect(leerJson(new Request("http://x/api", { method: "POST", body: "{no" }), z.object({}))).rejects.toMatchObject({ estado: 400 });
  });
});
