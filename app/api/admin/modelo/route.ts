import { manejar, leerJson } from "@/lib/api";
import { entrenarModeloSchema } from "@/lib/validators/modelo";
import { ServicioModelo } from "@/services/riesgo/ServicioModelo";

export const dynamic = "force-dynamic";
/** El entrenamiento recorre todo el panel estudiante-semestre: se da margen de tiempo en Vercel */
export const maxDuration = 60;

/** GET /api/admin/modelo — versiones del modelo de riesgo, la activa y el estado de los puntajes (ADMIN) */
export const GET = manejar(["ADMIN"], async () => new ServicioModelo().listar());

/** POST /api/admin/modelo — reentrena una versión nueva con los datos actuales (queda inactiva) */
export const POST = manejar(["ADMIN"], async ({ req, session }) => {
  const { C } = await leerJson(req, entrenarModeloSchema);
  return new ServicioModelo().entrenar(C, { usuarioId: session.user.id, rol: session.user.rol });
});
