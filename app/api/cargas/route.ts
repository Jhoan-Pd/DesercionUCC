import { manejar, ErrorApi } from "@/lib/api";
import { ServicioCarga } from "@/services/carga/ServicioCarga";
import { TAMANO_MAXIMO, TAMANO_MAXIMO_MB } from "@/services/carga/limites";

/** Bytes de los encabezados y separadores del formulario multipart */
const MARGEN_MULTIPART = 64 * 1024;

// Una carga de varios miles de estudiantes incluye el recálculo del riesgo
export const maxDuration = 60;

const servicio = new ServicioCarga();

/** Historial de cargas (solo administrador) */
export const GET = manejar(["ADMIN"], async () => ({ cargas: await servicio.historial() }));

/** Sube un archivo .xlsx o .csv con estudiantes (multipart/form-data, campo "archivo") */
export const POST = manejar(["ADMIN"], async ({ req, session }) => {
  // Se rechaza por el tamaño declarado ANTES de leer el formulario, que se guarda entero en memoria
  // (el margen cubre los separadores del multipart). El tamaño real se vuelve a revisar en el servicio.
  const declarado = Number(req.headers.get("content-length"));
  // Sin Content-Length (envío por partes) no se puede saber el tamaño antes de leerlo: se exige
  if (!req.headers.get("content-length") || !Number.isFinite(declarado)) throw new ErrorApi(411, "Falta el tamaño del archivo en la petición. Súbelo desde la página «Cargar datos».");
  if (declarado > TAMANO_MAXIMO + MARGEN_MULTIPART) throw new ErrorApi(413, `El archivo supera los ${TAMANO_MAXIMO_MB} MB.`);
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
