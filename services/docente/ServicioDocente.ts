import { prisma } from "@/lib/prisma";
import type { Rol } from "@/lib/roles";

/** Umbrales de las señales académicas que ve el docente */
export const UMBRAL_NOTA_BAJA = 3.0;
export const UMBRAL_INASISTENCIA = 80;

export interface EstudianteCurso {
  estudianteId: string;
  codigo: string;
  nombre: string;
  notaParcial: number | null;
  asistenciaPct: number;
  fallas: number;
  notaBaja: boolean;
  inasistencia: boolean;
  /** Alerta abierta reportada desde este curso */
  alertaAbierta: boolean;
}

export interface CursoDocente {
  id: string;
  codigo: string;
  nombre: string;
  programa: string;
  semestre: number;
  docente: string;
  estudiantes: EstudianteCurso[];
  conSenales: number;
}

/**
 * Panel docente. Principio de minimización (Ley 1581): el docente ve las señales ACADÉMICAS de
 * sus propios cursos (nota parcial, asistencia, fallas), no el puntaje del modelo ni datos
 * socioeconómicos. Si algo le preocupa, reporta una alerta a Bienestar.
 */
export class ServicioDocente {
  async cursos(usuario: { id: string; rol: Rol }, docenteId?: string): Promise<{ cursos: CursoDocente[]; periodo: string | null; docentes: { id: string; nombre: string }[] }> {
    const periodo = await prisma.periodo.findFirst({ where: { activo: true }, select: { id: true, codigo: true } });
    if (!periodo) return { cursos: [], periodo: null, docentes: [] };

    // ADMIN puede revisar el panel de cualquier docente; el docente solo el suyo
    const docentes =
      usuario.rol === "ADMIN"
        ? await prisma.usuario.findMany({ where: { rol: { nombre: "DOCENTE" }, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } })
        : [];
    const objetivo = usuario.rol === "ADMIN" ? docenteId ?? docentes[0]?.id : usuario.id;
    if (!objetivo) return { cursos: [], periodo: periodo.codigo, docentes };

    const filas = await prisma.curso.findMany({
      where: { periodoId: periodo.id, docenteId: objetivo },
      orderBy: [{ semestre: "asc" }, { codigo: "asc" }],
      include: {
        programa: { select: { nombre: true } },
        docente: { select: { nombre: true } },
        alertas: { where: { estado: { not: "CERRADA" } }, select: { estudianteId: true } },
        inscripciones: {
          include: { estudiante: { select: { id: true, codigo: true, nombres: true, apellidos: true } } },
          orderBy: { estudiante: { apellidos: "asc" } },
        },
      },
    });

    const cursos = filas.map((c) => {
      const conAlerta = new Set(c.alertas.map((a) => a.estudianteId));
      const estudiantes: EstudianteCurso[] = c.inscripciones.map((i) => {
        const notaBaja = i.notaParcial !== null && i.notaParcial < UMBRAL_NOTA_BAJA;
        const inasistencia = i.asistenciaPct < UMBRAL_INASISTENCIA;
        return {
          estudianteId: i.estudiante.id,
          codigo: i.estudiante.codigo,
          nombre: `${i.estudiante.apellidos} ${i.estudiante.nombres}`,
          notaParcial: i.notaParcial,
          asistenciaPct: i.asistenciaPct,
          fallas: i.fallas,
          notaBaja,
          inasistencia,
          alertaAbierta: conAlerta.has(i.estudiante.id),
        };
      });
      // Primero quienes tienen señales
      estudiantes.sort((a, b) => Number(b.notaBaja || b.inasistencia) - Number(a.notaBaja || a.inasistencia));
      return {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        programa: c.programa.nombre,
        semestre: c.semestre,
        docente: c.docente.nombre,
        estudiantes,
        conSenales: estudiantes.filter((e) => e.notaBaja || e.inasistencia).length,
      };
    });
    return { cursos, periodo: periodo.codigo, docentes };
  }
}
