import { z } from "zod";
import "./zod-es";

/** Opciones para reentrenar el modelo de riesgo desde el panel de administración */
export const entrenarModeloSchema = z.object({
  /** Inverso de la regularización L2: 1 es el valor por defecto de scikit-learn */
  C: z.number({ invalid_type_error: "La regularización debe ser un número" }).min(0.01, "C debe ser al menos 0,01").max(100, "C debe ser como máximo 100").default(1),
});
export type EntrenarModelo = z.infer<typeof entrenarModeloSchema>;

/** Al activar una versión se recalculan los puntajes salvo que se pida lo contrario */
export const activarModeloSchema = z.object({
  recalcular: z.boolean().default(true),
});
