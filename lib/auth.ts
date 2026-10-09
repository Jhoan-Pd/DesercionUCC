import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { esRol } from "@/lib/roles";
import { ERROR_CUENTA_BLOQUEADA, ESTADO_LIMPIO, consultarBloqueo, registrarFallo } from "@/lib/seguridad/bloqueo";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";

const credencialesSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Configuración de Auth.js (NextAuth v4).
 * - Proveedor de credenciales (correo + contraseña con hash bcrypt).
 * - Estrategia JWT: la sesión viaja en una cookie firmada (sin consultar la BD en cada petición),
 *   lo que además permite que el middleware (Edge) lea el rol sin acceder a Prisma.
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
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.user.rol = token.rol;
      session.user.estudianteId = token.estudianteId;
      return session;
    },
  },
};
