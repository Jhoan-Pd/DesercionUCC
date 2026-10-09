import type { PrismaClient } from "@prisma/client";
import { financiacionPrincipal, type RegistroEstudiante, type TipoFinanciacionRiesgo } from "./caracteristicas";

/**
 * Carga desde la base de datos los registros que necesita el modelo de riesgo.
 * Recibe el cliente como parámetro para poder usarse desde la app, el seed y los scripts de ml/.
 */
export async function cargarRegistros(
  prisma: PrismaClient,
  filtro: { soloEstados?: ("ACTIVO" | "GRADUADO" | "DESERTOR" | "APLAZADO")[]; ids?: string[] } = {},
): Promise<RegistroEstudiante[]> {
  const filas = await prisma.estudiante.findMany({
    where: {
      ...(filtro.soloEstados ? { estado: { in: filtro.soloEstados } } : {}),
      ...(filtro.ids ? { id: { in: filtro.ids } } : {}),
    },
    select: {
      id: true,
      estrato: true,
      edadIngreso: true,
      trabaja: true,
      horasTrabajoSemana: true,
      estado: true,
      semestreActual: true,
      programa: { select: { nombre: true } },
      financiaciones: { select: { tipo: true } },
      retiro: { select: { semestreRetiro: true } },
      notas: {
        select: { semestre: true, promedio: true, materiasPerdidas: true, asistenciaPct: true, periodo: { select: { activo: true } } },
      },
    },
    orderBy: { codigo: "asc" },
  });
  return filas.map((e) => ({
    id: e.id,
    programa: e.programa.nombre,
    estrato: e.estrato,
    edadIngreso: e.edadIngreso,
    trabaja: e.trabaja,
    horasTrabajoSemana: e.horasTrabajoSemana,
    financiacion: financiacionPrincipal(e.financiaciones.map((f) => f.tipo as TipoFinanciacionRiesgo)),
    estado: e.estado,
    semestreActual: e.semestreActual,
    semestreRetiro: e.retiro?.semestreRetiro ?? null,
    notas: e.notas.map((n) => ({
      semestre: n.semestre,
      promedio: n.promedio,
      materiasPerdidas: n.materiasPerdidas,
      asistenciaPct: n.asistenciaPct,
      periodoCerrado: !n.periodo.activo,
    })),
  }));
}
