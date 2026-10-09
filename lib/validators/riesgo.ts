import { z } from "zod";
import "./zod-es";

export const listaRiesgoSchema = z.object({
  nivel: z.enum(["BAJO", "MEDIO", "ALTO"]).optional(),
  programaId: z.string().uuid("Programa inválido").optional(),
  busqueda: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(60).optional(),
  conAlerta: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
  porPagina: z.coerce.number().int().min(5).max(100).default(25),
});
export type FiltrosRiesgo = z.infer<typeof listaRiesgoSchema>;

export const idSchema = z.object({ id: z.string().uuid("Identificador inválido") });
