import type { EstadoAlerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { Rol } from "@/lib/roles";
import type { CrearAlerta } from "@/lib/validators/alertas";

interface Solicitante {
  id: string;
  rol: Rol;
}

/** Alertas de deserción: las reportan docentes y Bienestar; las genera el modelo y la encuesta */
export class ServicioAlertas {
  async crear(datos: CrearAlerta, usuario: Solicitante) {
    const estudiante = await prisma.estudiante.findUnique({ where: { id: datos.estudianteId }, select: { id: true, estado: true } });
    if (!estudiante) throw new ErrorApi(404, "No se encontró el estudiante.");
    if (estudiante.estado === "DESERTOR" || estudiante.estado === "GRADUADO") {
      throw new ErrorApi(409, "Solo se pueden reportar alertas de estudiantes activos o aplazados.");
    }

    if (usuario.rol === "DOCENTE") {
      // Un docente solo puede reportar estudiantes inscritos en SUS cursos del periodo activo
      if (!datos.cursoId) throw new ErrorApi(400, "Indica el curso desde el que reportas la alerta.");
      const inscripcion = await prisma.inscripcion.findFirst({
        where: { cursoId: datos.cursoId, estudianteId: datos.estudianteId, curso: { docenteId: usuario.id, periodo: { activo: true } } },
        select: { id: true },
      });
      if (!inscripcion) throw new ErrorApi(403, "El estudiante no está inscrito en uno de tus cursos del periodo actual.");
      const repetida = await prisma.alerta.findFirst({
        where: { estudianteId: datos.estudianteId, cursoId: datos.cursoId, origen: "DOCENTE", estado: { not: "CERRADA" } },
        select: { id: true },
      });
      if (repetida) throw new ErrorApi(409, "Ya reportaste una alerta abierta para este estudiante en este curso.");
    } else if (datos.cursoId) {
      const curso = await prisma.curso.findUnique({ where: { id: datos.cursoId }, select: { id: true } });
      if (!curso) throw new ErrorApi(404, "No se encontró el curso.");
    }

    const alerta = await prisma.alerta.create({
      data: {
        estudianteId: datos.estudianteId,
        cursoId: datos.cursoId,
        creadaPorId: usuario.id,
        origen: usuario.rol === "DOCENTE" ? "DOCENTE" : "BIENESTAR",
        motivo: datos.motivo,
      },
      select: { id: true, estado: true, creadaEn: true },
    });
    return { ...alerta, creadaEn: alerta.creadaEn.toISOString() };
  }

  async cambiarEstado(id: string, estado: EstadoAlerta) {
    const existe = await prisma.alerta.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ErrorApi(404, "No se encontró la alerta.");
    const a = await prisma.alerta.update({ where: { id }, data: { estado }, select: { id: true, estado: true, actualizadaEn: true } });
    return { ...a, actualizadaEn: a.actualizadaEn.toISOString() };
  }
}
