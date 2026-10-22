import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { esRol } from "@/lib/roles";
import { ERROR_CUENTA_BLOQUEADA, ESTADO_LIMPIO, consultarBloqueo } from "@/lib/seguridad/bloqueo";
import { registrarIntentoFallido } from "@/lib/seguridad/intentos";
import { huellaContrasena, verificarContrasena } from "@/lib/seguridad/contrasenas";
import { revalidarSesion } from "@/lib/seguridad/sesion";

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
        });
        // Mismo resultado Y MISMO TIEMPO para correo inexistente o cuenta inactiva: no se revela qué cuentas existen
        if (!usuario || !usuario.activo) {
          await verificarContrasena(parsed.data.password, null);
          return null;
        }

        // Cuenta bloqueada por intentos fallidos: ni siquiera se verifica la contraseña
        if (consultarBloqueo(usuario).bloqueado) throw new Error(ERROR_CUENTA_BLOQUEADA);

        const coincide = await verificarContrasena(parsed.data.password, usuario.passwordHash);
        if (!coincide || !esRol(usuario.rol)) {
          const nuevo = await registrarIntentoFallido(prisma, usuario.id);
          if (nuevo.bloqueadoHasta) throw new Error(ERROR_CUENTA_BLOQUEADA);
          return null;
        }

        await prisma.usuario.update({ where: { id: usuario.id }, data: { ...ESTADO_LIMPIO, ultimoAcceso: new Date() } });

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          huella: huellaContrasena(usuario.passwordHash),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.rol = user.rol;
        token.huella = user.huella;
        token.revocada = false;
        return token;
      }
      if (!token.uid) return token;
      // Revalidación en cada petición del servidor: desactivar una cuenta, cambiarle el rol o
      // restablecer su contraseña surte efecto de inmediato, sin esperar a que el JWT expire
      // (ver lib/seguridad/sesion.ts)
      const cuenta = await prisma.usuario.findUnique({
        where: { id: token.uid },
        select: { activo: true, rol: true, passwordHash: true },
      });
      const r = revalidarSesion(cuenta && { activo: cuenta.activo, rol: cuenta.rol, huella: huellaContrasena(cuenta.passwordHash) }, token.huella);
      if (!r.valida) return { ...token, revocada: true };
      return { ...token, rol: r.rol, revocada: false };
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.user.rol = token.rol;
      session.revocada = token.revocada === true;
      return session;
    },
  },
};
