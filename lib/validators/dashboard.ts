import { z } from "zod";
import "./zod-es";

/** Filtros combinables del dashboard (vienen de la URL, por eso todo es texto opcional) */
export const filtrosDashboardSchema = z.object({
  programaId: z.string().uuid("Programa inválido").optional(),
  cohorteAnio: z.coerce.number({ invalid_type_error: "La cohorte debe ser un año" }).int().min(2000, "Cohorte fuera de rango").max(2100, "Cohorte fuera de rango").optional(),
  estrato: z.coerce.number({ invalid_type_error: "El estrato debe ser un número" }).int().min(1, "El estrato va de 1 a 6").max(6, "El estrato va de 1 a 6").optional(),
  financiacion: z.enum(["RECURSOS_PROPIOS", "ICETEX", "BECA", "CREDITO_UCC"]).optional(),
  sexo: z.enum(["F", "M", "O"]).optional(),
  trabaja: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type FiltrosDashboard = z.infer<typeof filtrosDashboardSchema>;
