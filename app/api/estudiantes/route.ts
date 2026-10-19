import { manejar, leerQuery } from "@/lib/api";
import { filtrosEstudiantesSchema } from "@/lib/validators/estudiantes";
import { ServicioEstudiantes } from "@/services/estudiantes/ServicioEstudiantes";
import { ServicioCarga } from "@/services/carga/ServicioCarga";

/** Lista de estudiantes activos con su nivel de riesgo (filtros: q, programa, nivel, pagina) */
export const GET = manejar(["ADMIN", "BIENESTAR"], async ({ req }) => new ServicioEstudiantes().listar(leerQuery(req, filtrosEstudiantesSchema)));

/** Borra todos los estudiantes cargados (solo administrador) */
export const DELETE = manejar(["ADMIN"], async () => new ServicioCarga().borrarTodo());
