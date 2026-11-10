import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/errores";
import { modeloDesdeEntorno } from "@/lib/ia/proveedor";
import { ErrorIA, textoDe, type ModeloIA } from "@/lib/ia/tipos";
import { factoresDe, faltantesDe } from "@/services/riesgo/persistencia";
import { datosDe } from "@/services/riesgo/variables";
import { SISTEMA_EXPLICACION, explicacionBasica, promptExplicacion, type EntradaExplicacion } from "./explicacion";

export interface ResultadoExplicacion {
  explicacion: string;
  origen: "IA" | "BASICA";
  modeloIa: string | null;
  explicadaEn: string | null;
  /** Por qué no se usó la IA (sin clave, límite de uso, error...) */
  aviso: string | null;
}

/**
 * Explicación del riesgo de un estudiante redactada por el agente de IA (Groq, con Gemini de respaldo).
 * Se guarda en la evaluación para no repetir la consulta; si el riesgo cambia en una nueva carga,
 * la evaluación se reemplaza y la explicación se vuelve a generar cuando alguien la pida.
 * Sin clave de IA (o si los proveedores fallan) se devuelve la explicación básica, calculada sin IA.
 */
export class ServicioExplicacion {
  constructor(private readonly cliente: ModeloIA | null = modeloDesdeEntorno()) {}

  async generar(codigo: string, regenerar = false): Promise<ResultadoExplicacion> {
    const e = await prisma.estudiante.findUnique({ where: { codigo }, include: { evaluacion: true } });
    if (!e) throw new ErrorApi(404, "No existe un estudiante con ese código.");
    const ev = e.evaluacion;
    if (!ev) throw new ErrorApi(409, "Este estudiante no tiene una evaluación de riesgo (solo se evalúan los estudiantes activos).");

    if (ev.explicacion && !regenerar) {
      return { explicacion: ev.explicacion, origen: "IA", modeloIa: ev.modeloIa, explicadaEn: ev.explicadaEn?.toISOString() ?? null, aviso: null };
    }

    const entrada: EntradaExplicacion = {
      programa: e.programa,
      datos: datosDe(e),
      puntaje: ev.puntaje,
      nivel: ev.nivel,
      metodo: ev.metodo,
      factores: factoresDe(ev.factores),
      faltantes: faltantesDe(ev.faltantes),
    };
    const basica = (aviso: string): ResultadoExplicacion => ({ explicacion: explicacionBasica(entrada), origen: "BASICA", modeloIa: null, explicadaEn: null, aviso });

    if (!this.cliente) return basica("El agente de IA no está configurado (falta GROQ_API_KEY o GEMINI_API_KEY). Esta es la explicación calculada por el sistema.");

    try {
      const partes = await this.cliente.generar({ sistema: SISTEMA_EXPLICACION, contenidos: [{ role: "user", parts: [{ text: promptExplicacion(entrada) }] }], temperatura: 0.3 });
      const texto = textoDe(partes);
      if (!texto) return basica("La IA no devolvió texto; se muestra la explicación calculada por el sistema.");
      const ahora = new Date();
      // updateMany y no update: si una carga reemplazó la evaluación mientras la IA respondía (hasta
      // 50 s), update fallaba con P2025 y se perdía el texto con un error 500. La explicación de una
      // evaluación que ya no existe no se guarda, pero se muestra con un aviso.
      const guardada = await prisma.evaluacion.updateMany({ where: { id: ev.id }, data: { explicacion: texto, explicadaEn: ahora, modeloIa: this.cliente.nombreModelo } });
      if (guardada.count === 0) {
        return { explicacion: texto, origen: "IA", modeloIa: this.cliente.nombreModelo, explicadaEn: null, aviso: "El riesgo se recalculó mientras se redactaba esta explicación. Vuelve a generarla para que use los datos nuevos." };
      }
      return { explicacion: texto, origen: "IA", modeloIa: this.cliente.nombreModelo, explicadaEn: ahora.toISOString(), aviso: null };
    } catch (err) {
      if (err instanceof ErrorIA) return basica(`${err.message} Mientras tanto, esta es la explicación calculada por el sistema.`);
      throw err;
    }
  }
}
