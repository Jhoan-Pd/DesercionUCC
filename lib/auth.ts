import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { esRol } from "@/lib/roles";

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
        if (!usuario || !usuario.activo) return null;

        const coincide = await bcrypt.compare(parsed.data.password, usuario.passwordHash);
        if (!coincide || !esRol(usuario.rol.nombre)) return null;

        await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });

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
