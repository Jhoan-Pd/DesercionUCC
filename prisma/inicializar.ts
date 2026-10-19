/**
 * Inicialización de la base de datos durante el despliegue (Vercel ejecuta `npm run vercel-build`
 * después de `prisma migrate deploy`).
 *
 * Solo crea la cuenta del primer administrador cuando no existe ninguno. No carga datos de ejemplo:
 * los estudiantes se cargan desde la página "Cargar datos" con información real de la universidad.
 */
import { PrismaClient } from "@prisma/client";
import { urlParaPrisma } from "../lib/url-base-datos";
import { crearAdministradorInicial } from "./seed";

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: urlParaPrisma(process.env.DATABASE_URL) });
  try {
    const r = await crearAdministradorInicial(prisma);
    console.log(r === "creado" ? "👤 Se creó la cuenta del primer administrador." : "ℹ️  Ya hay un administrador: no se crean cuentas.");
  } catch (e) {
    // No se detiene el despliegue: la página funciona y el aviso queda en el log del build
    console.warn("⚠️ ", e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
