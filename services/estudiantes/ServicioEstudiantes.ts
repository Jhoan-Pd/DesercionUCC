import type { NivelRiesgo, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FUENTE_REGLA } from "@/services/riesgo/factores";
import { factoresDe, faltantesDe } from "@/services/riesgo/persistencia";
import { ServicioEvaluacion } from "@/services/riesgo/ServicioEvaluacion";
import { datosDe } from "@/services/riesgo/variables";

export interface FiltrosEstudiantes {
  q?: string;
  programa?: string;
  nivel?: NivelRiesgo;
  pagina?: number;
  porPagina?: number;
}

/** Estudiante que el agente menciona en su respuesta (con nombre: se agrega en el servidor, nunca viaja a la IA) */
export interface EstudianteMencionado {
  codigo: string;
  nombre: string;
  programa: string;
  nivel: NivelRiesgo | null;
  puntaje: number | null;
}

export interface FilaEstudiante {
  codigo: string;
  nombre: string;
  programa: string;
  semestre: number;
  puntaje: number | null;
  nivel: NivelRiesgo | null;
  factores: string[];
}

const MAX_FACTORES_FRECUENTES = 6;

/** Consultas de estudiantes y del resumen de riesgo (solo estudiantes ACTIVOS cargados por el administrador) */
export class ServicioEstudiantes {
  async programas(): Promise<string[]> {
    const filas = await prisma.estudiante.findMany({ where: { estado: "ACTIVO" }, distinct: ["programa"], select: { programa: true }, orderBy: { programa: "asc" } });
    return filas.map((f) => f.programa);
  }

  async listar(f: FiltrosEstudiantes = {}): Promise<{ filas: FilaEstudiante[]; total: number; pagina: number; paginas: number }> {
    const porPagina = Math.min(100, f.porPagina ?? 25);
    const where: Prisma.EstudianteWhereInput = {
      estado: "ACTIVO",
      ...(f.programa ? { programa: f.programa } : {}),
      ...(f.nivel ? { evaluacion: { nivel: f.nivel } } : {}),
      ...(f.q ? { OR: [{ nombre: { contains: f.q, mode: "insensitive" } }, { codigo: { contains: f.q, mode: "insensitive" } }] } : {}),
    };
    const total = await prisma.estudiante.count({ where });
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    const pagina = Math.min(Math.max(1, f.pagina ?? 1), paginas);
    const filas = await prisma.estudiante.findMany({
      where,
      include: { evaluacion: true },
      orderBy: [{ evaluacion: { puntaje: "desc" } }, { nombre: "asc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    });
    return {
      total,
      pagina,
      paginas,
      filas: filas.map((e) => ({
        codigo: e.codigo,
        nombre: e.nombre,
        programa: e.programa,
        semestre: e.semestre,
        puntaje: e.evaluacion?.puntaje ?? null,
        nivel: e.evaluacion?.nivel ?? null,
        factores: factoresDe(e.evaluacion?.factores).map((x) => x.etiqueta),
      })),
    };
  }

  /** Datos básicos de varios estudiantes, en el mismo orden de los códigos recibidos (omite los que no existan) */
  async mencionados(codigos: string[]): Promise<EstudianteMencionado[]> {
    if (codigos.length === 0) return [];
    const filas = await prisma.estudiante.findMany({
      where: { codigo: { in: codigos } },
      select: { codigo: true, nombre: true, programa: true, evaluacion: { select: { nivel: true, puntaje: true } } },
    });
    const porCodigo = new Map(filas.map((e) => [e.codigo, e]));
    return codigos.flatMap((codigo) => {
      const e = porCodigo.get(codigo);
      return e ? [{ codigo: e.codigo, nombre: e.nombre, programa: e.programa, nivel: e.evaluacion?.nivel ?? null, puntaje: e.evaluacion?.puntaje ?? null }] : [];
    });
  }

  async detalle(codigo: string) {
    const e = await prisma.estudiante.findUnique({ where: { codigo }, include: { evaluacion: true, carga: { select: { archivo: true, creadaEn: true } } } });
    if (!e) return null;
    const ev = e.evaluacion;
    return {
      codigo: e.codigo,
      nombre: e.nombre,
      programa: e.programa,
      estado: e.estado,
      periodo: e.periodo,
      datos: datosDe(e),
      cargadoDe: e.carga ? { archivo: e.carga.archivo, fecha: e.carga.creadaEn.toISOString() } : null,
      actualizadoEn: e.actualizadoEn.toISOString(),
      evaluacion: ev
        ? {
            puntaje: ev.puntaje,
            nivel: ev.nivel,
            metodo: ev.metodo,
            modeloVersion: ev.modeloVersion,
            factores: factoresDe(ev.factores).map((f) => ({ ...f, fuente: ev.metodo === "FACTORES" ? FUENTE_REGLA[f.clave] ?? null : null })),
            faltantes: faltantesDe(ev.faltantes),
            calculadoEn: ev.calculadoEn.toISOString(),
            explicacion: ev.explicacion,
            explicadaEn: ev.explicadaEn?.toISOString() ?? null,
            modeloIa: ev.modeloIa,
          }
        : null,
    };
  }

  /** Resumen para la página de inicio */
  async resumen() {
    const [activos, porNivel, porProgramaNivel, ultimaCarga, estadoModelo, conResultado, factoresFrecuentes] = await Promise.all([
      prisma.estudiante.count({ where: { estado: "ACTIVO" } }),
      prisma.evaluacion.groupBy({ by: ["nivel"], _count: { _all: true } }),
      prisma.$queryRaw<{ programa: string; nivel: NivelRiesgo; n: bigint }[]>`
        SELECT e."programa", v."nivel", COUNT(*) AS n
        FROM "evaluaciones" v JOIN "estudiantes" e ON e."id" = v."estudianteId"
        WHERE e."estado" = 'ACTIVO'
        GROUP BY e."programa", v."nivel"`,
      prisma.carga.findFirst({ orderBy: { creadaEn: "desc" }, include: { usuario: { select: { nombre: true } } } }),
      new ServicioEvaluacion().estadoModelo(),
      prisma.estudiante.groupBy({ by: ["estado"], _count: { _all: true } }),
      // Conteo en la base de datos: no hace falta traer el JSON de cada evaluación a memoria
      prisma.$queryRaw<{ etiqueta: string; n: number }[]>`
        SELECT f->>'etiqueta' AS "etiqueta", COUNT(*)::int AS "n"
        FROM "evaluaciones" v
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(v."factores") = 'array' THEN v."factores" ELSE '[]'::jsonb END) AS f
        WHERE v."nivel" IN ('ALTO', 'MEDIO') AND f->>'etiqueta' IS NOT NULL
        GROUP BY 1
        ORDER BY "n" DESC, "etiqueta"
        LIMIT ${MAX_FACTORES_FRECUENTES}`,
    ]);

    const nivel = { ALTO: 0, MEDIO: 0, BAJO: 0 } as Record<NivelRiesgo, number>;
    for (const g of porNivel) nivel[g.nivel] = g._count._all;

    const programas = new Map<string, Record<NivelRiesgo, number> & { total: number }>();
    for (const r of porProgramaNivel) {
      const p = programas.get(r.programa) ?? { ALTO: 0, MEDIO: 0, BAJO: 0, total: 0 };
      p[r.nivel] += Number(r.n);
      p.total += Number(r.n);
      programas.set(r.programa, p);
    }

    return {
      activos,
      nivel,
      programas: [...programas.entries()]
        .map(([programa, c]) => ({ programa, ...c }))
        .sort((a, b) => b.ALTO - a.ALTO || b.total - a.total),
      /** Factores más frecuentes entre quienes tienen riesgo medio o alto */
      factores: factoresFrecuentes,
      conResultado: Object.fromEntries(conResultado.map((g) => [g.estado, g._count._all])) as Partial<Record<"ACTIVO" | "RETIRADO" | "GRADUADO", number>>,
      ultimaCarga: ultimaCarga ? { archivo: ultimaCarga.archivo, fecha: ultimaCarga.creadaEn.toISOString(), usuario: ultimaCarga.usuario.nombre } : null,
      modelo: estadoModelo,
    };
  }
}
