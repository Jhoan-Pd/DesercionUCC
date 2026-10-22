import { z } from "zod";
import "./zod-es";

/** Mensajes anteriores que acompañan cada pregunta: el agente solo necesita los últimos */
export const MAX_HISTORIAL = 10;
/** Largo máximo de cada mensaje del historial (una respuesta larga se recorta, no rechaza la pregunta) */
export const LARGO_MAXIMO_MENSAJE = 6000;

const mensajeSchema = z.object({ rol: z.enum(["usuario", "agente"]), texto: z.string().max(LARGO_MAXIMO_MENSAJE) });

export const preguntaAgenteSchema = z.object({
  pregunta: z.string().trim().min(2, "Escribe una pregunta").max(1000, "La pregunta es demasiado larga (máximo 1.000 caracteres)"),
  historial: z.array(mensajeSchema).max(MAX_HISTORIAL).default([]),
});

/**
 * Historial que el navegador envía con cada pregunta. Antes se enviaba la conversación completa:
 * después de 10 intercambios (o de una respuesta de más de 6.000 caracteres) la API respondía 400
 * a cualquier pregunta nueva hasta recargar la página.
 */
export function historialParaEnviar(mensajes: readonly { rol: "usuario" | "agente"; texto: string }[]): z.infer<typeof mensajeSchema>[] {
  return mensajes.slice(-MAX_HISTORIAL).map(({ rol, texto }) => ({ rol, texto: texto.slice(0, LARGO_MAXIMO_MENSAJE) }));
}

export const explicacionSchema = z.object({ regenerar: z.boolean().optional() });
