import { manejar, ErrorApi } from "@/lib/api";
import { ServicioCarga } from "@/services/carga/ServicioCarga";

// Una carga de varios miles de estudiantes incluye el recálculo del riesgo
export const maxDuration = 60;

const servicio = new ServicioCarga();

/** Historial de cargas (solo administrador) */
export const GET = manejar(["ADMIN"], async () => ({ cargas: await servicio.historial() }));

/** Sube un archivo .xlsx o .csv con estudiantes (multipart/form-data, campo "archivo") */
export const POST = manejar(["ADMIN"], async ({ req, session }) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ErrorApi(400, "Envía el archivo en un formulario (campo «archivo»).");
  }
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) throw new ErrorApi(400, "No llegó ningún archivo.");
  return servicio.procesar(archivo.name, await archivo.arrayBuffer(), session.user.id);
});
