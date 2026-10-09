import { z } from "zod";
import "./zod-es";

export const TIPOS_INTERVENCION = ["TUTORIA", "APOYO_ECONOMICO", "ACOMPANAMIENTO_PSICOLOGICO", "ORIENTACION_VOCACIONAL", "OTRO"] as const;
export const ESTADOS_INTERVENCION = ["EN_CURSO", "COMPLETADA", "CANCELADA"] as const;

export const listaIntervencionesSchema = z.object({
  estado: z.enum(ESTADOS_INTERVENCION).optional(),
  tipo: z.enum(TIPOS_INTERVENCION).optional(),
  busqueda: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
  porPagina: z.coerce.number().int().min(5).max(100).default(20),
});
export type FiltrosIntervenciones = z.infer<typeof listaIntervencionesSchema>;

export const crearIntervencionSchema = z
  .object({
    /** Se acepta el id interno (desde la ficha) o el código institucional (desde el formulario) */
    estudianteId: z.string().uuid("Estudiante inválido").optional(),
    codigo: z.string().trim().min(3, "Código inválido").max(30).optional(),
    tipo: z.enum(TIPOS_INTERVENCION),
    descripcion: z.string().trim().min(10, "Describe la intervención con al menos 10 caracteres").max(1000, "Máximo 1000 caracteres"),
    montoApoyo: z.number().int("El monto debe ser un número entero de pesos").min(1, "El monto debe ser mayor que 0").max(100_000_000, "El monto es demasiado alto").optional(),
    alertaId: z.string().uuid("Alerta inválida").optional(),
  })
  .refine((v) => v.estudianteId || v.codigo, { message: "Indica el estudiante (código)", path: ["codigo"] })
  .refine((v) => v.tipo !== "APOYO_ECONOMICO" || v.montoApoyo !== undefined, {
    message: "El apoyo económico requiere el monto entregado",
    path: ["montoApoyo"],
  });
export type CrearIntervencion = z.infer<typeof crearIntervencionSchema>;

export const actualizarIntervencionSchema = z
  .object({
    estado: z.enum(ESTADOS_INTERVENCION),
    resultado: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
  })
  .refine((v) => v.estado === "EN_CURSO" || (v.resultado?.length ?? 0) >= 10, {
    message: "Al cerrar o cancelar, registra el resultado (al menos 10 caracteres)",
    path: ["resultado"],
  });
export type ActualizarIntervencion = z.infer<typeof actualizarIntervencionSchema>;
