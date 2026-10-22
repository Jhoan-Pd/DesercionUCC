import type { ZodTypeAny, z } from "zod";
import { ErrorApi } from "@/lib/errores";

/**
 * Lectura del cuerpo de las peticiones con tamaño acotado. Vive aparte de lib/api.ts (que depende de
 * Auth.js y Prisma) para que se pueda probar sin base de datos.
 */

/** Tamaño máximo de un cuerpo JSON (la pregunta más larga con su historial cabe holgada) */
export const LIMITE_JSON_BYTES = 128 * 1024;

/**
 * Lee el cuerpo como texto sin pasar de `limite` bytes. req.json() guardaba en memoria cualquier
 * tamaño antes de que Zod lo rechazara; aquí se corta en cuanto se pasa, con o sin Content-Length.
 */
export async function leerTextoAcotado(req: Request, limite: number): Promise<string> {
  if (Number(req.headers.get("content-length") ?? 0) > limite) throw new ErrorApi(413, "La petición es demasiado grande.");
  if (!req.body) return "";
  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await lector.cancel();
      throw new ErrorApi(413, "La petición es demasiado grande.");
    }
    partes.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(partes));
}

/** Valida el cuerpo JSON de la petición con un esquema Zod */
export async function leerJson<T extends ZodTypeAny>(req: Request, esquema: T): Promise<z.infer<T>> {
  const texto = await leerTextoAcotado(req, LIMITE_JSON_BYTES);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    throw new ErrorApi(400, "El cuerpo de la petición no es un JSON válido.");
  }
  return esquema.parse(cuerpo);
}
