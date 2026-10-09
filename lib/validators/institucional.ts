import { z } from "zod";
import "./zod-es";

export const filtrosInstitucionalSchema = z.object({
  programaId: z.string().uuid("Programa inválido").optional(),
});
export type FiltrosInstitucional = z.infer<typeof filtrosInstitucionalSchema>;
