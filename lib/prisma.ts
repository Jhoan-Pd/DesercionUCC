import { PrismaClient } from "@prisma/client";

/**
 * Instancia única de PrismaClient.
 * En desarrollo, Next.js recarga módulos en caliente y crearía una conexión nueva en cada
 * recarga; guardarla en globalThis evita agotar las conexiones de la base de datos.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
