import { z } from "zod";
import "./zod-es";

export const actualizarParametroSchema = z.object({
  id: z.string().uuid("Identificador inválido"),
  valor: z.number({ invalid_type_error: "El valor debe ser numérico" }).finite("El valor debe ser un número finito").min(0, "El valor no puede ser negativo"),
});

export const actualizarParametrosSchema = z.object({
  cambios: z.array(actualizarParametroSchema).min(1, "Envía al menos un cambio").max(100),
});

export type ActualizarParametros = z.infer<typeof actualizarParametrosSchema>;
