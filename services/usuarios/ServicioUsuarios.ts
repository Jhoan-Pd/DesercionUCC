import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { ActualizarUsuario, CrearUsuario } from "@/lib/validators/usuarios";
import { consultarBloqueo, ESTADO_LIMPIO } from "@/lib/seguridad/bloqueo";
import { validarCambio } from "./reglas";

export class ServicioUsuarios {
  async listar() {
    const usuarios = await prisma.usuario.findMany({ orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }] });
    return usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      bloqueado: consultarBloqueo(u).bloqueado,
      ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
    }));
  }

  async crear(datos: CrearUsuario) {
    if (await prisma.usuario.findUnique({ where: { email: datos.email } })) throw new ErrorApi(409, "Ya existe una cuenta con ese correo.");
    const u = await prisma.usuario.create({
      data: { nombre: datos.nombre, email: datos.email, rol: datos.rol, passwordHash: await bcrypt.hash(datos.password, 10) },
    });
    return { id: u.id };
  }

  async actualizar(id: string, cambio: ActualizarUsuario, actorId: string) {
    const objetivo = await prisma.usuario.findUnique({ where: { id } });
    if (!objetivo) throw new ErrorApi(404, "La cuenta no existe.");
    const adminsActivos = await prisma.usuario.count({ where: { rol: "ADMIN", activo: true } });
    const error = validarCambio({ actorId, objetivo, cambio, adminsActivos });
    if (error) throw new ErrorApi(422, error);
    await prisma.usuario.update({
      where: { id },
      data: {
        ...(cambio.nombre ? { nombre: cambio.nombre } : {}),
        ...(cambio.rol ? { rol: cambio.rol } : {}),
        ...(cambio.activo !== undefined ? { activo: cambio.activo } : {}),
        ...(cambio.password ? { passwordHash: await bcrypt.hash(cambio.password, 10), ...ESTADO_LIMPIO } : {}),
        ...(cambio.desbloquear ? ESTADO_LIMPIO : {}),
      },
    });
    return { ok: true };
  }
}
