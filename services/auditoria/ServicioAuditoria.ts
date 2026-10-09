import { prisma } from "@/lib/prisma";

export type AccionAuditoria =
  | "CONSULTA_FICHA"
  | "CONSULTA_CALCULADORA"
  | "EXPORTACION"
  | "IMPORTACION"
  | "INTERVENCION"
  | "LOGIN_BLOQUEADO"
  | "ADMIN_USUARIOS"
  | "ADMIN_CATALOGOS"
  | "ADMIN_MODELO";

export interface EventoAuditoria {
  usuarioId: string;
  rol: string;
  accion: AccionAuditoria;
  /** Identificador anónimo (hash) o nombre del recurso: nunca nombres ni documentos */
  recurso: string;
  detalle?: string;
}

/**
 * Registro persistente de accesos a datos personales (Ley 1581 de 2012, principio de
 * responsabilidad demostrada). Un fallo al auditar NUNCA debe tumbar la operación principal:
 * se informa en el log del servidor y se continúa.
 */
export class ServicioAuditoria {
  async registrar(evento: EventoAuditoria): Promise<void> {
    try {
      await prisma.auditoriaAcceso.create({ data: { ...evento, detalle: evento.detalle ?? null } });
    } catch (error) {
      console.error("[AUDITORIA] No se pudo registrar el evento", evento.accion, error);
    }
  }

  async listar(opciones: { pagina?: number; porPagina?: number; accion?: string } = {}) {
    const porPagina = Math.min(opciones.porPagina ?? 50, 200);
    const pagina = Math.max(1, opciones.pagina ?? 1);
    const where = opciones.accion ? { accion: opciones.accion } : {};
    const [total, filas] = await Promise.all([
      prisma.auditoriaAcceso.count({ where }),
      prisma.auditoriaAcceso.findMany({
        where,
        orderBy: { creadoEn: "desc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: { usuario: { select: { nombre: true, email: true } } },
      }),
    ]);
    return {
      total,
      pagina,
      porPagina,
      filas: filas.map((f) => ({
        id: f.id,
        fecha: f.creadoEn.toISOString(),
        usuario: f.usuario.nombre,
        email: f.usuario.email,
        rol: f.rol,
        accion: f.accion,
        recurso: f.recurso,
        detalle: f.detalle,
      })),
    };
  }
}
