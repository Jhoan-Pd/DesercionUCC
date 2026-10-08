import { manejar, leerJson } from "@/lib/api";
import { entradaImpactoSchema } from "@/lib/validators/impacto";
import { prisma } from "@/lib/prisma";
import { ServicioImpacto } from "@/services/impacto/ServicioImpacto";

export const dynamic = "force-dynamic";

/** POST /api/impacto/calcular — recibe los datos del formulario y devuelve el análisis completo */
export const POST = manejar(null, async ({ req }) => {
  const entrada = await leerJson(req, entradaImpactoSchema);
  // Si el programa existe, se usan sus parámetros específicos (p. ej. salario de enganche propio)
  const programa = await prisma.programa.findUnique({ where: { nombre: entrada.programa.nombre }, select: { id: true } });
  return new ServicioImpacto().calcular(entrada, programa?.id);
});
