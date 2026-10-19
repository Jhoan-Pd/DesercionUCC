import { z } from "zod";
import "./zod-es";

export const preguntaAgenteSchema = z.object({
  pregunta: z.string().trim().min(2, "Escribe una pregunta").max(1000, "La pregunta es demasiado larga (máximo 1.000 caracteres)"),
  historial: z
    .array(z.object({ rol: z.enum(["usuario", "agente"]), texto: z.string().max(6000) }))
    .max(20)
    .default([]),
});

export const explicacionSchema = z.object({ regenerar: z.boolean().optional() });
