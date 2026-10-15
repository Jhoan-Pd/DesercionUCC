import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { esRol } from "@/lib/roles";
import { ERROR_CUENTA_BLOQUEADA, ESTADO_LIMPIO, consultarBloqueo, registrarFallo } from "@/lib/seguridad/bloqueo";
import { revalidarSesion } from "@/lib/seguridad/sesion";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";

const credencialesSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Configuración de Auth.js (NextAuth v4).
 * - Proveedor de credenciales (correo + contraseña con hash bcrypt).
 * - Estrategia JWT: la sesión viaja en una cookie firmada, lo que permite que el middleware (Edge)
 *   filtre por rol sin acceder a Prisma. En el servidor, cada petición revalida la cuenta contra la
 *   BD (activa y rol actual), así una cuenta desactivada pierde el acceso de inmediato.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 horas
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo institucional", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credencialesSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
          include: { rol: true },
        });
        // Mismo resultado para correo inexistente o cuenta inactiva: no se revela qué cuentas existen
        if (!usuario || !usuario.activo) return null;

        // Cuenta bloqueada por intentos fallidos: ni siquiera se verifica la contraseña
        if (consultarBloqueo(usuario).bloqueado) throw new Error(ERROR_CUENTA_BLOQUEADA);

        const coincide = await bcrypt.compare(parsed.data.password, usuario.passwordHash);
        if (!coincide || !esRol(usuario.rol.nombre)) {
          const nuevo = registrarFallo(usuario);
          await prisma.usuario.update({ where: { id: usuario.id }, data: nuevo });
          if (nuevo.bloqueadoHasta) {
            await new ServicioAuditoria().registrar({ usuarioId: usuario.id, rol: usuario.rol.nombre, accion: "LOGIN_BLOQUEADO", recurso: "cuenta", detalle: `${nuevo.intentosFallidos} intentos fallidos seguidos` });
            throw new Error(ERROR_CUENTA_BLOQUEADA);
          }
          return null;
        }

        await prisma.usuario.update({ where: { id: usuario.id }, data: { ...ESTADO_LIMPIO, ultimoAcceso: new Date() } });

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol.nombre,
          estudianteId: usuario.estudianteId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.rol = user.rol;
        token.estudianteId = user.estudianteId;
        token.revocada = false;
        return token;
      }
      if (!token.uid) return token;
      // Revalidación en cada petición del servidor: desactivar una cuenta o cambiarle el rol
      // surte efecto de inmediato, sin esperar a que el JWT expire (ver lib/seguridad/sesion.ts)
      const cuenta = await prisma.usuario.findUnique({
        where: { id: token.uid },
        select: { activo: true, estudianteId: true, rol: { select: { nombre: true } } },
      });
      const r = revalidarSesion(cuenta ? { activo: cuenta.activo, rol: cuenta.rol.nombre, estudianteId: cuenta.estudianteId } : null);
      if (!r.valida) return { ...token, revocada: true };
      return { ...token, rol: r.rol, estudianteId: r.estudianteId, revocada: false };
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.user.rol = token.rol;
      session.user.estudianteId = token.estudianteId;
      session.revocada = token.revocada === true;
      return session;
    },
  },
};
