import { prisma } from "@/lib/prisma";
import { ErrorApi, esViolacionDeUnicidad } from "@/lib/errores";
import { bloquear } from "@/lib/bloqueos";
import type { ActualizarUsuario, CrearUsuario } from "@/lib/validators/usuarios";
import { consultarBloqueo, ESTADO_LIMPIO } from "@/lib/seguridad/bloqueo";
import { cifrarContrasena } from "@/lib/seguridad/contrasenas";
import type { Rol } from "@/lib/roles";
import { validarCambio } from "./reglas";

/** Cuenta tal como se muestra en la página de usuarios (sin el hash de la contraseña) */
export interface UsuarioFila {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  bloqueado: boolean;
  ultimoAcceso: string | null;
}

export class ServicioUsuarios {
  async listar(): Promise<UsuarioFila[]> {
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
    // La restricción UNIQUE del correo decide: consultar primero y crear después dejaba una carrera
    // entre dos administradores que crean la misma cuenta al tiempo (el segundo recibía un error 500).
    try {
      const u = await prisma.usuario.create({
        data: { nombre: datos.nombre, email: datos.email, rol: datos.rol, passwordHash: await cifrarContrasena(datos.password) },
      });
      return { id: u.id };
    } catch (e) {
      if (esViolacionDeUnicidad(e)) throw new ErrorApi(409, "Ya existe una cuenta con ese correo.");
      throw e;
    }
  }

  async actualizar(id: string, cambio: ActualizarUsuario, actorId: string) {
    // bcrypt tarda ~70 ms: se calcula antes de tomar el bloqueo para no retener a los demás
    const passwordHash = cambio.password ? await cifrarContrasena(cambio.password) : undefined;
    // Contar los administradores y guardar el cambio debe ser atómico: si dos administradores se quitan
    // el rol el uno al otro al mismo tiempo, los dos veían «2 activos» y el sistema quedaba sin ninguno.
    // El bloqueo CUENTAS hace que el segundo cambio espere y cuente después del primero.
    await prisma.$transaction(async (tx) => {
      await bloquear(tx, "CUENTAS");
      const objetivo = await tx.usuario.findUnique({ where: { id } });
      if (!objetivo) throw new ErrorApi(404, "La cuenta no existe.");
      const adminsActivos = await tx.usuario.count({ where: { rol: "ADMIN", activo: true } });
      const error = validarCambio({ actorId, objetivo, cambio, adminsActivos });
      if (error) throw new ErrorApi(422, error);
      await tx.usuario.update({
        where: { id },
        data: {
          ...(cambio.nombre ? { nombre: cambio.nombre } : {}),
          ...(cambio.rol ? { rol: cambio.rol } : {}),
          ...(cambio.activo !== undefined ? { activo: cambio.activo } : {}),
          ...(passwordHash ? { passwordHash, ...ESTADO_LIMPIO } : {}),
          ...(cambio.desbloquear ? ESTADO_LIMPIO : {}),
        },
      });
    });
    return { ok: true };
  }
}
