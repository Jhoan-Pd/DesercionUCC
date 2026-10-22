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
