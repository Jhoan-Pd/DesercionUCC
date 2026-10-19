/**
 * Datos iniciales del Observatorio de Deserción UCC.
 *   npm run db:seed        (equivale a: prisma db seed)
 *
 * NO crea estudiantes ni datos de ejemplo: la información de estudiantes la carga el administrador
 * desde un archivo real de la universidad (página "Cargar datos"). Lo único que se crea es la
 * cuenta del primer administrador, y solo si todavía no hay ninguno (nunca borra nada).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { urlParaPrisma } from "../lib/url-base-datos";
import { cuentaInicial } from "./cuenta-inicial";

const prisma = new PrismaClient({ datasourceUrl: urlParaPrisma(process.env.DATABASE_URL) });

export async function crearAdministradorInicial(cliente: PrismaClient = prisma): Promise<"creado" | "existente"> {
  const admins = await cliente.usuario.count({ where: { rol: "ADMIN" } });
  if (admins > 0) return "existente";
  const cuenta = cuentaInicial(process.env);
  await cliente.usuario.create({
    data: {
      email: cuenta.email,
      nombre: "Administrador del Observatorio",
      passwordHash: await bcrypt.hash(cuenta.password, 10),
      rol: "ADMIN",
    },
  });
  return "creado";
}

async function main() {
  const r = await crearAdministradorInicial();
  console.log(r === "creado" ? `👤 Cuenta de administrador creada (${cuentaInicial(process.env).email}).` : "ℹ️  Ya existe un administrador: no se crea ninguna cuenta.");
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  main()
    .catch((e) => {
      console.error("❌", e instanceof Error ? e.message : e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
