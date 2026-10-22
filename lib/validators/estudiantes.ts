import { z } from "zod";
import "./zod-es";
import { NIVELES } from "@/services/riesgo/niveles";
import { LARGO_MAXIMO } from "@/services/carga/limites";

export const filtrosEstudiantesSchema = z.object({
  q: z.string().trim().max(80).optional(),
  programa: z.string().trim().max(LARGO_MAXIMO.programa).optional(),
  nivel: z.enum(NIVELES).optional(),
  pagina: z.coerce.number().int().min(1).max(10000).optional(),
});

export const codigoSchema = z.string().trim().min(1).max(LARGO_MAXIMO.codigo);
