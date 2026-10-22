/**
 * Error controlado de la aplicación: lleva el código HTTP con el que debe responder la API.
 * Vive aparte de lib/api.ts (que depende de Next.js y Auth.js) para que los servicios lo usen sin
 * depender de la capa HTTP.
 */
export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

/**
 * ¿El error es una violación de una restricción UNIQUE (código P2002 de Prisma)?
 * Se revisa el código y no la clase, porque la clase cambia según el motor de Prisma que se use.
 */
export function esViolacionDeUnicidad(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}
