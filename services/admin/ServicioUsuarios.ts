import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import { esRol, type Rol } from "@/lib/roles";
import { consultarBloqueo, ESTADO_LIMPIO } from "@/lib/seguridad/bloqueo";
import type { ActualizarUsuario, CrearUsuario, FiltrosUsuarios } from "@/lib/validators/admin";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { validarCambioUsuario, validarContrasena } from "./reglas";

interface Solicitante {
  usuarioId: string;
  rol: Rol;
}

const POR_PAGINA = 25;

/**
 * Gestión de cuentas (solo ADMIN). Las cuentas no se eliminan —tienen alertas, intervenciones y
 * auditoría asociadas—: se desactivan, y gracias a la revalidación de sesión pierden el acceso de inmediato.
 * Las contraseñas solo se guardan como hash bcrypt y nunca se escriben en la auditoría.
 */
export class ServicioUsuarios {
  private readonly auditoria = new ServicioAuditoria();

  async listar(f: FiltrosUsuarios) {
    const ahora = new Date();
    const where: Prisma.UsuarioWhereInput = {
      ...(f.rol ? { rol: { nombre: f.rol } } : {}),
      ...(f.estado === "activos" ? { activo: true } : f.estado === "inactivos" ? { activo: false } : f.estado === "bloqueados" ? { bloqueadoHasta: { gt: ahora } } : {}),
      ...(f.busqueda
        ? { OR: [{ nombre: { contains: f.busqueda, mode: "insensitive" } }, { email: { contains: f.busqueda, mode: "insensitive" } }] }
        : {}),
    };
    const [total, filas, porRol] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({
        where,
        orderBy: [{ rol: { nombre: "asc" } }, { nombre: "asc" }],
        skip: (f.pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        include: { rol: true, estudiante: { select: { codigo: true } } },
      }),
      prisma.usuario.groupBy({ by: ["rolId"], where: { activo: true }, _count: { _all: true } }),
    ]);
    const roles = await prisma.rol.findMany();
    return {
      filas: filas.map((u) => {
        const bloqueo = consultarBloqueo(u, ahora);
        return {
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          rol: u.rol.nombre as Rol,
          activo: u.activo,
          estudianteCodigo: u.estudiante?.codigo ?? null,
          ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
          bloqueado: bloqueo.bloqueado,
          minutosBloqueo: bloqueo.minutosRestantes,
          intentosFallidos: u.intentosFallidos,
        };
      }),
      total,
      pagina: f.pagina,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      activosPorRol: Object.fromEntries(roles.map((r) => [r.nombre, porRol.find((x) => x.rolId === r.id)?._count._all ?? 0])) as Record<string, number>,
    };
  }

  private async rolId(nombre: Rol): Promise<number> {
    const rol = await prisma.rol.findUnique({ where: { nombre } });
    if (!rol) throw new ErrorApi(500, `El rol ${nombre} no existe en la base de datos.`);
    return rol.id;
  }

  /** Busca el estudiante por código y verifica que no tenga ya una cuenta (excepto la propia) */
  private async estudianteLibre(codigo: string, exceptoUsuarioId?: string): Promise<string> {
    const est = await prisma.estudiante.findUnique({ where: { codigo }, select: { id: true, usuario: { select: { id: true, email: true } } } });
    if (!est) throw new ErrorApi(404, `No existe un estudiante con el código ${codigo}.`);
    if (est.usuario && est.usuario.id !== exceptoUsuarioId) throw new ErrorApi(409, `El estudiante ${codigo} ya tiene la cuenta ${est.usuario.email}.`);
    return est.id;
  }

  async crear(d: CrearUsuario, s: Solicitante) {
    const problema = validarContrasena(d.contrasena);
    if (problema) throw new ErrorApi(400, problema);
    if (await prisma.usuario.findUnique({ where: { email: d.email } })) throw new ErrorApi(409, `Ya existe una cuenta con el correo ${d.email}.`);
    const estudianteId = d.rol === "ESTUDIANTE" && d.codigoEstudiante ? await this.estudianteLibre(d.codigoEstudiante) : null;

    const usuario = await prisma.usuario.create({
      data: {
        email: d.email,
        nombre: d.nombre,
        passwordHash: await bcrypt.hash(d.contrasena, 10),
        rolId: await this.rolId(d.rol),
        estudianteId,
      },
    });
    await this.auditoria.registrar({ usuarioId: s.usuarioId, rol: s.rol, accion: "ADMIN_USUARIOS", recurso: `usuario:${d.email}`, detalle: `creado con rol ${d.rol}` });
    return { id: usuario.id };
  }

  async actualizar(id: string, c: ActualizarUsuario, s: Solicitante) {
    const actual = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } });
    if (!actual) throw new ErrorApi(404, "La cuenta no existe.");
    const rolActual = actual.rol.nombre;
    const rolNuevo = c.rol ?? (esRol(rolActual) ? rolActual : undefined);

    const adminsActivos = await prisma.usuario.count({ where: { activo: true, rol: { nombre: "ADMIN" } } });
    const problema = validarCambioUsuario({
      esUnoMismo: id === s.usuarioId,
      rolActual,
      rolNuevo: c.rol,
      activoActual: actual.activo,
      activoNuevo: c.activo,
      adminsActivos,
    });
    if (problema) throw new ErrorApi(409, problema);
    if (c.contrasena !== undefined) {
      const p = validarContrasena(c.contrasena);
      if (p) throw new ErrorApi(400, p);
    }

    // Enlace con el registro académico: obligatorio para ESTUDIANTE, se quita para los demás roles
    let estudianteId: string | null | undefined;
    if (rolNuevo === "ESTUDIANTE") {
      if (c.codigoEstudiante) estudianteId = await this.estudianteLibre(c.codigoEstudiante, id);
      else if (c.codigoEstudiante === null || !actual.estudianteId) throw new ErrorApi(400, "Una cuenta de ESTUDIANTE debe estar enlazada al código de un estudiante.");
    } else if (actual.estudianteId) estudianteId = null;

    const data: Prisma.UsuarioUncheckedUpdateInput = {
      ...(c.nombre !== undefined ? { nombre: c.nombre } : {}),
      ...(c.rol !== undefined ? { rolId: await this.rolId(c.rol) } : {}),
      ...(c.activo !== undefined ? { activo: c.activo } : {}),
      ...(estudianteId !== undefined ? { estudianteId } : {}),
      // Restablecer la contraseña también quita un bloqueo vigente
      ...(c.contrasena !== undefined ? { passwordHash: await bcrypt.hash(c.contrasena, 10), ...ESTADO_LIMPIO } : {}),
      ...(c.desbloquear ? ESTADO_LIMPIO : {}),
    };
    await prisma.usuario.update({ where: { id }, data });

    const cambios = [
      c.nombre !== undefined && "nombre",
      c.rol !== undefined && c.rol !== rolActual && `rol ${rolActual} → ${c.rol}`,
      c.activo !== undefined && c.activo !== actual.activo && (c.activo ? "activada" : "desactivada"),
      estudianteId !== undefined && "enlace con estudiante",
      c.contrasena !== undefined && "contraseña restablecida",
      c.desbloquear && "desbloqueada",
    ].filter(Boolean);
    await this.auditoria.registrar({ usuarioId: s.usuarioId, rol: s.rol, accion: "ADMIN_USUARIOS", recurso: `usuario:${actual.email}`, detalle: cambios.join(", ") || "sin cambios" });
    return { id };
  }
}
