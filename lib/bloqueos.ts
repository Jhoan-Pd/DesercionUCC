import type { Prisma } from "@prisma/client";

/**
 * Bloqueos consultivos de PostgreSQL (pg_advisory_xact_lock): serializan operaciones que leen y
 * después escriben y que no deben ejecutarse a la vez. El bloqueo se libera solo al confirmar o
 * deshacer la transacción, así que sirve también detrás de PgBouncer/Neon (modo transacción).
 */
export const BLOQUEOS = {
  /** Cargas de estudiantes y borrado total */
  DATOS: 7_314_001,
  /** Cambios de rol o de estado de las cuentas (regla del último administrador activo) */
  CUENTAS: 7_314_002,
} as const;

export type RecursoBloqueado = keyof typeof BLOQUEOS;

/** Espera hasta tener el recurso para esta transacción */
export async function bloquear(tx: Pick<Prisma.TransactionClient, "$executeRaw">, recurso: RecursoBloqueado): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BLOQUEOS[recurso]})`;
}
