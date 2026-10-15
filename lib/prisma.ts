import { PrismaClient } from "@prisma/client";
import { urlParaPrisma } from "./url-base-datos";

/**
 * Instancia única de PrismaClient.
 * En desarrollo, Next.js recarga módulos en caliente y crearía una conexión nueva en cada
 * recarga; guardarla en globalThis evita agotar las conexiones de la base de datos.
 * La URL pasa por urlParaPrisma para que funcione detrás del pooler de Neon o Supabase.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: urlParaPrisma(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
