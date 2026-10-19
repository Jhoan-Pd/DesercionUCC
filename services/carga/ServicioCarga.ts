import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import { ServicioEvaluacion } from "@/services/riesgo/ServicioEvaluacion";
import { leerExcel } from "./excel";
import { validarTabla, type ErrorFila, type EstudianteArchivo, type ResultadoLectura } from "./lector";
import { parsearCSV } from "./csv";

export const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB
const LOTE = 500;
const MAX_ERRORES_GUARDADOS = 200;

export interface ResumenCarga {
  archivo: string;
  filas: number;
  nuevos: number;
  actualizados: number;
  errores: ErrorFila[];
  totalErrores: number;
  ignoradas: string[];
  modelo: { estado: "INSUFICIENTE" | "ACTIVADO" | "NO_ACTIVADO"; motivo: string };
  evaluados: number;
}

/** Texto de un CSV: UTF-8, y si trae caracteres inválidos (archivo guardado por Excel en Windows), Latin-1 */
export function decodificarTexto(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("�") ? new TextDecoder("latin1").decode(buffer) : utf8;
}

export async function leerArchivo(nombre: string, buffer: ArrayBuffer): Promise<ResultadoLectura> {
  const ext = nombre.toLowerCase().split(".").pop();
  if (ext === "xlsx") {
    try {
      return validarTabla(await leerExcel(buffer));
    } catch {
      throw new ErrorApi(400, "No se pudo leer el archivo de Excel. Guárdalo como .xlsx o como CSV e inténtalo de nuevo.");
    }
  }
  if (ext === "csv" || ext === "txt") return validarTabla(parsearCSV(decodificarTexto(buffer)));
  throw new ErrorApi(400, "Formato no admitido. Sube un archivo .xlsx o .csv (puedes partir de la plantilla).");
}

/** Inserta o actualiza por código en lotes con un solo INSERT ... ON CONFLICT (rápido incluso con miles de filas) */
async function guardar(estudiantes: EstudianteArchivo[], cargaId: string): Promise<{ nuevos: number; actualizados: number }> {
  let nuevos = 0;
  for (let i = 0; i < estudiantes.length; i += LOTE) {
    const lote = estudiantes.slice(i, i + LOTE);
    const filas = lote.map(
      (e) => Prisma.sql`(${randomUUID()}, ${e.codigo}, ${e.nombre}, ${e.programa}, ${e.semestre}, ${e.promedio}, ${e.materiasPerdidas}, ${e.asistencia}, ${e.estrato}, ${e.trabaja}, ${e.apoyoFinanciero}, ${e.moraMatricula}, ${e.puntajeSaber11}, ${e.edad}, ${e.estado}::"EstadoEstudiante", ${e.periodo}, ${cargaId}, NOW(), NOW())`,
    );
    const r = await prisma.$queryRaw<{ nuevo: boolean }[]>`
      INSERT INTO "estudiantes" ("id", "codigo", "nombre", "programa", "semestre", "promedio", "materiasPerdidas", "asistencia", "estrato", "trabaja", "apoyoFinanciero", "moraMatricula", "puntajeSaber11", "edad", "estado", "periodo", "cargaId", "creadoEn", "actualizadoEn")
      VALUES ${Prisma.join(filas)}
      ON CONFLICT ("codigo") DO UPDATE SET
        "nombre" = EXCLUDED."nombre", "programa" = EXCLUDED."programa", "semestre" = EXCLUDED."semestre",
        "promedio" = EXCLUDED."promedio", "materiasPerdidas" = EXCLUDED."materiasPerdidas", "asistencia" = EXCLUDED."asistencia",
        "estrato" = EXCLUDED."estrato", "trabaja" = EXCLUDED."trabaja", "apoyoFinanciero" = EXCLUDED."apoyoFinanciero",
        "moraMatricula" = EXCLUDED."moraMatricula", "puntajeSaber11" = EXCLUDED."puntajeSaber11", "edad" = EXCLUDED."edad",
        "estado" = EXCLUDED."estado", "periodo" = EXCLUDED."periodo", "cargaId" = EXCLUDED."cargaId", "actualizadoEn" = NOW()
      RETURNING (xmax = 0) AS "nuevo"`;
    nuevos += r.filter((x) => x.nuevo).length;
  }
  return { nuevos, actualizados: estudiantes.length - nuevos };
}

export class ServicioCarga {
  private readonly evaluacion = new ServicioEvaluacion();

  async procesar(nombre: string, buffer: ArrayBuffer, usuarioId: string): Promise<ResumenCarga> {
    if (buffer.byteLength === 0) throw new ErrorApi(400, "El archivo está vacío.");
    if (buffer.byteLength > TAMANO_MAXIMO) throw new ErrorApi(413, "El archivo supera los 5 MB.");
    const lectura = await leerArchivo(nombre, buffer);
    const filas = lectura.estudiantes.length + lectura.errores.filter((e) => e.fila > 1).length;

    if (lectura.estudiantes.length === 0) {
      return {
        archivo: nombre,
        filas,
        nuevos: 0,
        actualizados: 0,
        errores: lectura.errores.slice(0, MAX_ERRORES_GUARDADOS),
        totalErrores: lectura.errores.length,
        ignoradas: lectura.ignoradas,
        modelo: { estado: "INSUFICIENTE", motivo: "No se cargó ningún estudiante." },
        evaluados: 0,
      };
    }

    const carga = await prisma.carga.create({
      data: { archivo: nombre.slice(0, 200), filas, nuevos: 0, actualizados: 0, errores: lectura.errores.slice(0, MAX_ERRORES_GUARDADOS) as unknown as Prisma.InputJsonValue, usuarioId },
    });
    const { nuevos, actualizados } = await guardar(lectura.estudiantes, carga.id);
    await prisma.carga.update({ where: { id: carga.id }, data: { nuevos, actualizados } });

    const modelo = await this.evaluacion.entrenar();
    const { evaluados } = await this.evaluacion.recalcular();
    return {
      archivo: nombre,
      filas,
      nuevos,
      actualizados,
      errores: lectura.errores.slice(0, MAX_ERRORES_GUARDADOS),
      totalErrores: lectura.errores.length,
      ignoradas: lectura.ignoradas,
      modelo,
      evaluados,
    };
  }

  async historial(limite = 20) {
    const cargas = await prisma.carga.findMany({ orderBy: { creadaEn: "desc" }, take: limite, include: { usuario: { select: { nombre: true } } } });
    return cargas.map((c) => ({
      id: c.id,
      archivo: c.archivo,
      filas: c.filas,
      nuevos: c.nuevos,
      actualizados: c.actualizados,
      errores: Array.isArray(c.errores) ? c.errores.length : 0,
      usuario: c.usuario.nombre,
      creadaEn: c.creadaEn.toISOString(),
    }));
  }

  /** Borra TODOS los estudiantes, sus evaluaciones, las cargas y los modelos (para empezar de cero) */
  async borrarTodo(): Promise<{ estudiantes: number }> {
    const [, r] = await prisma.$transaction([
      prisma.evaluacion.deleteMany(),
      prisma.estudiante.deleteMany(),
      prisma.carga.deleteMany(),
      prisma.modeloRiesgo.deleteMany(),
    ]);
    return { estudiantes: r.count };
  }
}
