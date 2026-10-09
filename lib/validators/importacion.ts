import { z } from "zod";
import "./zod-es";

/** 5 MB de texto: ~25.000 filas, holgado frente al máximo de 10.000 que acepta el importador */
const MAX_CARACTERES = 5_000_000;

export const importarCsvSchema = z.object({
  archivo: z
    .string()
    .trim()
    .min(1, "Indica el nombre del archivo")
    .max(200)
    .regex(/\.csv$/i, "El archivo debe tener extensión .csv"),
  contenido: z.string().min(1, "El archivo está vacío").max(MAX_CARACTERES, "El archivo supera 5 MB; divídelo en varios archivos"),
  /** false = solo validar y mostrar la vista previa; true = importar */
  confirmar: z.boolean().default(false),
});
export type ImportarCsv = z.infer<typeof importarCsvSchema>;
