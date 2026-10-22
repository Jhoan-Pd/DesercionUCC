import type { PrismaClient } from "@prisma/client";
import { registrarFallo, type EstadoBloqueo } from "./bloqueo";

/**
 * Registra una contraseña incorrecta sin perder intentos cuando llegan varios a la vez.
 *
 * Leer el contador, sumar uno en memoria y guardarlo dejaba una carrera: diez intentos en paralelo
 * leían todos «0 fallos» y guardaban «1», así que la cuenta nunca se bloqueaba. Aquí la fila se lee
 * con SELECT … FOR UPDATE dentro de una transacción: cada intento espera al anterior y la regla
 * (registrarFallo, función pura y probada) se aplica sobre el valor real.
 */
export async function registrarIntentoFallido(db: Pick<PrismaClient, "$transaction">, usuarioId: string, ahora: Date = new Date()): Promise<EstadoBloqueo> {
  return db.$transaction(async (tx) => {
    const [actual] = await tx.$queryRaw<EstadoBloqueo[]>`
      SELECT "intentosFallidos", "bloqueadoHasta" FROM "usuarios" WHERE "id" = ${usuarioId} FOR UPDATE`;
    if (!actual) return { intentosFallidos: 0, bloqueadoHasta: null };
    const nuevo = registrarFallo(actual, ahora);
    await tx.usuario.update({ where: { id: usuarioId }, data: nuevo });
    return nuevo;
  });
}
