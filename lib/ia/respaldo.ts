import { ErrorIA, type ModeloIA, type ParametrosGeneracion, type ParteIA } from "./tipos";

/** Tiempo durante el cual, después de una falla, se va directo al respaldo (no se insiste en el caído) */
export const PAUSA_TRAS_FALLA_MS = 60_000;

/** Proveedores caídos y hasta cuándo, compartido por todas las peticiones de esta instancia del servidor */
const caidosHasta = new Map<string, number>();

/**
 * Modelo con respaldo (patrón Composite / Decorator sobre ModeloIA): consulta el principal y, si falla
 * por algo del proveedor (saturado, sin cuota, clave inválida, tiempo agotado), pasa la misma
 * consulta al respaldo. Tras una falla el principal queda en pausa un minuto, así el resto de la
 * conversación (y las siguientes preguntas) no esperan otra vez a un proveedor caído.
 * Un 422 (filtros de seguridad) es por el contenido: no se reintenta en otro proveedor.
 */
export class ModeloConRespaldo implements ModeloIA {
  private usado: ModeloIA;

  constructor(
    private readonly principal: ModeloIA,
    private readonly respaldo: ModeloIA,
    /** Nombre con que se recuerda la pausa del principal (los nombres de clase cambian al minificar) */
    private readonly clave: string = "principal",
    private readonly ahora: () => number = Date.now,
  ) {
    this.usado = principal;
  }

  get nombreModelo(): string {
    return this.usado.nombreModelo;
  }

  async generar(params: ParametrosGeneracion): Promise<ParteIA[]> {
    const clave = this.clave;
    if ((caidosHasta.get(clave) ?? 0) <= this.ahora()) {
      try {
        const partes = await this.principal.generar(params);
        this.usado = this.principal;
        caidosHasta.delete(clave);
        return partes;
      } catch (e) {
        if (!(e instanceof ErrorIA) || e.estado === 422) throw e;
        console.warn(`[ia] ${this.principal.nombreModelo} falló (${e.estado}: ${e.message}); se usa el respaldo ${this.respaldo.nombreModelo}`);
        caidosHasta.set(clave, this.ahora() + PAUSA_TRAS_FALLA_MS);
      }
    }
    this.usado = this.respaldo;
    return this.respaldo.generar(params);
  }
}

/** Solo para pruebas: olvida las pausas */
export function reiniciarPausas(): void {
  caidosHasta.clear();
}
