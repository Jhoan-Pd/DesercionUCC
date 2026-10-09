import { z } from "zod";
import "./zod-es";

export const TIPOS_REPORTE = ["institucional", "riesgo", "intervenciones", "impacto-institucional"] as const;

export const tipoReporteSchema = z.object({
  tipo: z.enum(TIPOS_REPORTE, { errorMap: () => ({ message: "Tipo de reporte no válido" }) }),
});

export const opcionesReporteSchema = z.object({
  formato: z.enum(["pdf", "xlsx"], { errorMap: () => ({ message: "El formato debe ser pdf o xlsx" }) }).default("pdf"),
  programaId: z.string().uuid("Programa inválido").optional(),
});
export type OpcionesReporte = z.infer<typeof opcionesReporteSchema>;
