import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import { ETIQUETA_ROL, type Rol } from "@/lib/roles";
import type { OpcionesReporte } from "@/lib/validators/reportes";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { ServicioDashboard } from "@/services/dashboard/ServicioDashboard";
import { ServicioImpactoInstitucional } from "@/services/institucional/ServicioImpactoInstitucional";
import { ServicioIntervenciones } from "@/services/intervenciones/ServicioIntervenciones";
import { ModeloRiesgo, type Factor } from "@/services/riesgo/ModeloRiesgo";
import { ServicioRiesgo } from "@/services/riesgo/ServicioRiesgo";
import {
  contenidoImpactoInstitucional,
  contenidoInstitucional,
  contenidoIntervenciones,
  contenidoRiesgo,
  type ContextoReporte,
  type FilaRiesgoAnonima,
} from "./contenido";
import { GeneradorReportes } from "./GeneradorReportes";
import type { DatosReporte, TipoReporte } from "./tipos";

export interface ArchivoReporte {
  contenido: Buffer;
  nombre: string;
  tipoMime: string;
}

const MIME = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

interface Solicitante {
  usuarioId: string;
  rol: Rol;
}

/**
 * Reportes exportables (PDF y Excel). Reutiliza los servicios de cada módulo, arma el contenido
 * anonimizado y deja constancia de cada exportación en la auditoría (Ley 1581 de 2012).
 */
export class ServicioReportes {
  async exportar(tipo: TipoReporte, opciones: OpcionesReporte, solicitante: Solicitante): Promise<ArchivoReporte> {
    const datos = await this.construir(tipo, opciones, solicitante);
    const generador = new GeneradorReportes(datos);
    const contenido = opciones.formato === "pdf" ? generador.aPdf() : await generador.aExcel();

    await new ServicioAuditoria().registrar({
      usuarioId: solicitante.usuarioId,
      rol: solicitante.rol,
      accion: "EXPORTACION",
      recurso: `reporte:${tipo}`,
      detalle: [`formato=${opciones.formato}`, ...datos.filtros].join(" · "),
    });
    return { contenido, nombre: generador.nombreArchivo(opciones.formato), tipoMime: MIME[opciones.formato] };
  }

  async construir(tipo: TipoReporte, opciones: OpcionesReporte, solicitante: Solicitante): Promise<DatosReporte> {
    const ctx: ContextoReporte = {
      generadoEn: new Date(),
      generadoPorRol: ETIQUETA_ROL[solicitante.rol],
      filtros: await this.describirFiltros(tipo, opciones),
    };
    switch (tipo) {
      case "institucional":
        return contenidoInstitucional(await new ServicioDashboard().obtenerResumen({ programaId: opciones.programaId }), ctx);
      case "riesgo": {
        const { filas, resumen } = await this.filasRiesgo(opciones.programaId);
        return contenidoRiesgo(filas, resumen, ctx);
      }
      case "intervenciones":
        return contenidoIntervenciones(await new ServicioIntervenciones().efectividad(), ctx);
      case "impacto-institucional":
        return contenidoImpactoInstitucional(await new ServicioImpactoInstitucional().obtener({ programaId: opciones.programaId }), ctx);
    }
  }

  private async describirFiltros(tipo: TipoReporte, opciones: OpcionesReporte): Promise<string[]> {
    if (!opciones.programaId || tipo === "intervenciones") return [];
    const programa = await prisma.programa.findUnique({ where: { id: opciones.programaId }, select: { nombre: true } });
    if (!programa) throw new ErrorApi(404, "El programa indicado no existe.");
    return [`Programa: ${programa.nombre}`];
  }

  /**
   * Lista de riesgo SIN datos personales: la consulta no selecciona nombres, documentos ni
   * códigos institucionales; solo el hash anónimo del estudiante.
   */
  private async filasRiesgo(programaId?: string) {
    const periodo = await prisma.periodo.findFirst({ where: { activo: true } });
    if (!periodo) throw new ErrorApi(409, "No hay un periodo académico activo.");
    const filtroEstudiante = programaId ? { programaId } : {};
    const [puntajes, porNivel, modelo] = await Promise.all([
      prisma.puntajeRiesgo.findMany({
        where: { periodoId: periodo.id, nivel: { in: ["ALTO", "MEDIO"] }, estudiante: filtroEstudiante },
        orderBy: [{ puntaje: "desc" }, { estudiante: { hashAnonimo: "asc" } }],
        select: {
          puntaje: true,
          nivel: true,
          factores: true,
          estudiante: {
            select: {
              hashAnonimo: true,
              semestreActual: true,
              programa: { select: { nombre: true } },
              _count: {
                select: {
                  alertas: { where: { estado: { not: "CERRADA" } } },
                  intervenciones: { where: { estado: "EN_CURSO" } },
                },
              },
            },
          },
        },
      }),
      prisma.puntajeRiesgo.groupBy({ by: ["nivel"], where: { periodoId: periodo.id, estudiante: filtroEstudiante }, _count: { _all: true } }),
      new ServicioRiesgo().modeloActivo(),
    ]);
    const cuenta = (n: "ALTO" | "MEDIO" | "BAJO") => porNivel.find((x) => x.nivel === n)?._count._all ?? 0;
    const filas: FilaRiesgoAnonima[] = puntajes.map((p) => {
      const factores = ((p.factores as unknown as Factor[]) ?? []).filter((f) => f.aporte > 0.05).slice(0, 3);
      return {
        hashAnonimo: p.estudiante.hashAnonimo,
        programa: p.estudiante.programa.nombre,
        semestre: p.estudiante.semestreActual,
        puntaje: p.puntaje,
        nivel: p.nivel,
        factores: factores.map((f) => ModeloRiesgo.describir(f)),
        alertasAbiertas: p.estudiante._count.alertas,
        intervencionesEnCurso: p.estudiante._count.intervenciones,
      };
    });
    return {
      filas,
      resumen: { ALTO: cuenta("ALTO"), MEDIO: cuenta("MEDIO"), BAJO: cuenta("BAJO"), periodo: periodo.codigo, modelo: modelo.version },
    };
  }
}
