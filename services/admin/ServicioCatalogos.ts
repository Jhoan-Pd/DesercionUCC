import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { Rol } from "@/lib/roles";
import type { CambiosPeriodo, CambiosPrograma, DatosPeriodo, DatosPrograma } from "@/lib/validators/admin";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { claveTexto } from "@/services/importacion/csv";
import { codigoPeriodo, indicePeriodo, validarFechasPeriodo } from "./reglas";

interface Usuario {
  usuarioId: string;
  rol: Rol;
}

const CLAVE_SALARIO = "salario_profesional_mensual";

/**
 * Catálogos académicos que administra el ADMIN: programas y periodos.
 * No se borra información con historia: un programa con estudiantes se desactiva y un periodo
 * con matrículas no se elimina, para no romper cohortes, trayectorias ni indicadores.
 */
export class ServicioCatalogos {
  private readonly auditoria = new ServicioAuditoria();

  // ------------------------------------------------------------------ Programas

  async listarProgramas() {
    const [programas, salarios, activos] = await Promise.all([
      prisma.programa.findMany({ orderBy: { nombre: "asc" }, include: { _count: { select: { estudiantes: true } } } }),
      prisma.parametroEconomico.findMany({ where: { clave: CLAVE_SALARIO, programaId: { not: null } }, select: { programaId: true, valor: true } }),
      prisma.estudiante.groupBy({ by: ["programaId"], where: { estado: { in: ["ACTIVO", "APLAZADO"] } }, _count: { _all: true } }),
    ]);
    return programas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      facultad: p.facultad,
      duracionSemestres: p.duracionSemestres,
      valorSemestre: p.valorSemestre,
      activo: p.activo,
      estudiantes: p._count.estudiantes,
      estudiantesActivos: activos.find((a) => a.programaId === p.id)?._count._all ?? 0,
      salarioEnganche: salarios.find((s) => s.programaId === p.id)?.valor ?? null,
    }));
  }

  private async verificarNombreLibre(nombre: string, exceptoId?: string) {
    const todos = await prisma.programa.findMany({ select: { id: true, nombre: true } });
    const choque = todos.find((p) => p.id !== exceptoId && claveTexto(p.nombre) === claveTexto(nombre));
    if (choque) throw new ErrorApi(409, `Ya existe el programa "${choque.nombre}".`);
  }

  private async guardarSalario(programaId: string, nombrePrograma: string, valor: number, usuarioId: string) {
    const existente = await prisma.parametroEconomico.findFirst({ where: { clave: CLAVE_SALARIO, programaId } });
    const datos = { valor, nombre: `Ingreso mensual de enganche — ${nombrePrograma}`, actualizadoPorId: usuarioId };
    if (existente) await prisma.parametroEconomico.update({ where: { id: existente.id }, data: datos });
    else
      await prisma.parametroEconomico.create({
        data: { ...datos, categoria: "SALARIO", clave: CLAVE_SALARIO, unidad: "COP", programaId, fuente: "Registrado por el administrador (verificar con el OLE)" },
      });
  }

  async crearPrograma(d: DatosPrograma, u: Usuario) {
    await this.verificarNombreLibre(d.nombre);
    const programa = await prisma.programa.create({
      data: { nombre: d.nombre, facultad: d.facultad, duracionSemestres: d.duracionSemestres, valorSemestre: d.valorSemestre, activo: d.activo },
    });
    if (d.salarioEnganche !== undefined) await this.guardarSalario(programa.id, programa.nombre, d.salarioEnganche, u.usuarioId);
    await this.auditoria.registrar({ usuarioId: u.usuarioId, rol: u.rol, accion: "ADMIN_CATALOGOS", recurso: `programa:${programa.nombre}`, detalle: "creado" });
    return { id: programa.id };
  }

  async actualizarPrograma(id: string, c: CambiosPrograma, u: Usuario) {
    const actual = await prisma.programa.findUnique({ where: { id } });
    if (!actual) throw new ErrorApi(404, "El programa no existe.");
    if (c.nombre && c.nombre !== actual.nombre) await this.verificarNombreLibre(c.nombre, id);
    const { salarioEnganche, ...campos } = c;
    const programa = await prisma.programa.update({ where: { id }, data: campos });
    if (salarioEnganche !== undefined) await this.guardarSalario(id, programa.nombre, salarioEnganche, u.usuarioId);
    else if (c.nombre && c.nombre !== actual.nombre) {
      await prisma.parametroEconomico.updateMany({ where: { clave: CLAVE_SALARIO, programaId: id }, data: { nombre: `Ingreso mensual de enganche — ${programa.nombre}` } });
    }
    await this.auditoria.registrar({
      usuarioId: u.usuarioId,
      rol: u.rol,
      accion: "ADMIN_CATALOGOS",
      recurso: `programa:${programa.nombre}`,
      detalle: `actualizado: ${Object.keys(c).join(", ")}`,
    });
    return { id };
  }

  async eliminarPrograma(id: string, u: Usuario) {
    const p = await prisma.programa.findUnique({ where: { id }, include: { _count: { select: { estudiantes: true } } } });
    if (!p) throw new ErrorApi(404, "El programa no existe.");
    if (p._count.estudiantes > 0) {
      throw new ErrorApi(409, `El programa tiene ${p._count.estudiantes} estudiantes con historia académica: desactívalo en lugar de eliminarlo.`);
    }
    await prisma.programa.delete({ where: { id } }); // sus parámetros propios se borran en cascada
    await this.auditoria.registrar({ usuarioId: u.usuarioId, rol: u.rol, accion: "ADMIN_CATALOGOS", recurso: `programa:${p.nombre}`, detalle: "eliminado" });
    return { id };
  }

  // ------------------------------------------------------------------ Periodos

  async listarPeriodos() {
    const periodos = await prisma.periodo.findMany({
      orderBy: { indice: "desc" },
      include: { _count: { select: { matriculas: true, estudiantesIngreso: true, retiros: true } } },
    });
    return periodos.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      anio: p.anio,
      semestre: p.semestre,
      fechaInicio: p.fechaInicio.toISOString().slice(0, 10),
      fechaFin: p.fechaFin.toISOString().slice(0, 10),
      activo: p.activo,
      matriculas: p._count.matriculas,
      ingresos: p._count.estudiantesIngreso,
      retiros: p._count.retiros,
    }));
  }

  async crearPeriodo(d: DatosPeriodo, u: Usuario) {
    const codigo = codigoPeriodo(d.anio, d.semestre);
    if (await prisma.periodo.findUnique({ where: { codigo } })) throw new ErrorApi(409, `El periodo ${codigo} ya existe.`);
    const problema = validarFechasPeriodo(d.anio, d.fechaInicio, d.fechaFin);
    if (problema) throw new ErrorApi(400, problema);

    const datos = { codigo, anio: d.anio, semestre: d.semestre, indice: indicePeriodo(d.anio, d.semestre), fechaInicio: d.fechaInicio, fechaFin: d.fechaFin };
    const periodo = d.activo
      ? (await prisma.$transaction([prisma.periodo.updateMany({ where: { activo: true }, data: { activo: false } }), prisma.periodo.create({ data: { ...datos, activo: true } })]))[1]
      : await prisma.periodo.create({ data: { ...datos, activo: false } });
    await this.auditoria.registrar({ usuarioId: u.usuarioId, rol: u.rol, accion: "ADMIN_CATALOGOS", recurso: `periodo:${codigo}`, detalle: d.activo ? "creado y activado" : "creado" });
    return { id: periodo.id, codigo };
  }

  /** Cambia fechas o activa el periodo (solo puede haber uno activo: se desactiva el anterior en la misma transacción) */
  async actualizarPeriodo(id: string, c: CambiosPeriodo, u: Usuario) {
    const actual = await prisma.periodo.findUnique({ where: { id } });
    if (!actual) throw new ErrorApi(404, "El periodo no existe.");
    const inicio = c.fechaInicio ?? actual.fechaInicio;
    const fin = c.fechaFin ?? actual.fechaFin;
    if (c.fechaInicio || c.fechaFin) {
      const problema = validarFechasPeriodo(actual.anio, inicio, fin);
      if (problema) throw new ErrorApi(400, problema);
    }
    await prisma.$transaction([
      ...(c.activo ? [prisma.periodo.updateMany({ where: { activo: true, id: { not: id } }, data: { activo: false } })] : []),
      prisma.periodo.update({ where: { id }, data: { fechaInicio: inicio, fechaFin: fin, ...(c.activo ? { activo: true } : {}) } }),
    ]);
    await this.auditoria.registrar({
      usuarioId: u.usuarioId,
      rol: u.rol,
      accion: "ADMIN_CATALOGOS",
      recurso: `periodo:${actual.codigo}`,
      detalle: c.activo ? "activado como periodo actual" : "fechas actualizadas",
    });
    return { id, codigo: actual.codigo, activo: c.activo ?? actual.activo };
  }

  async eliminarPeriodo(id: string, u: Usuario) {
    const p = await prisma.periodo.findUnique({
      where: { id },
      include: { _count: { select: { matriculas: true, notas: true, retiros: true, estudiantesIngreso: true, puntajes: true } } },
    });
    if (!p) throw new ErrorApi(404, "El periodo no existe.");
    if (p.activo) throw new ErrorApi(409, "No se puede eliminar el periodo activo. Activa otro periodo primero.");
    const usos = Object.values(p._count).reduce((a, b) => a + b, 0);
    if (usos > 0) throw new ErrorApi(409, `El periodo ${p.codigo} tiene información académica asociada (${usos} registros) y no se puede eliminar.`);
    await prisma.periodo.delete({ where: { id } });
    await this.auditoria.registrar({ usuarioId: u.usuarioId, rol: u.rol, accion: "ADMIN_CATALOGOS", recurso: `periodo:${p.codigo}`, detalle: "eliminado" });
    return { id };
  }
}
