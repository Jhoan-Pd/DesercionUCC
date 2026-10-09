import { z } from "zod";
import "./zod-es";

export const crearAlertaSchema = z.object({
  estudianteId: z.string().uuid("Estudiante inválido"),
  cursoId: z.string().uuid("Curso inválido").optional(),
  motivo: z.string().trim().min(10, "Describe el motivo con al menos 10 caracteres").max(500, "El motivo no puede superar 500 caracteres"),
});
export type CrearAlerta = z.infer<typeof crearAlertaSchema>;

export const cambiarEstadoAlertaSchema = z.object({
  estado: z.enum(["ABIERTA", "EN_SEGUIMIENTO", "CERRADA"]),
});
