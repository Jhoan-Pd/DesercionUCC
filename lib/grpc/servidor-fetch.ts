import { createConnectRouter, type ConnectRouter, type ConnectRouterOptions } from "@connectrpc/connect";
import { createFetchHandler } from "@connectrpc/connect/protocol";

/**
 * Adaptador de un router de Connect al API Fetch (Request -> Response), que es lo que usan las
 * rutas del App Router de Next.js. Cada método del servicio queda en
 *   POST {prefijo}/{paquete}.{Servicio}/{Método}
 * p. ej. /api/grpc/observatorio.riesgo.v1.MotorRiesgoService/Evaluar
 */
export function crearServidorFetch(rutas: (router: ConnectRouter) => void, prefijo: string, opciones: ConnectRouterOptions = {}) {
  const router = createConnectRouter(opciones);
  rutas(router);
  // Map ruta -> manejador: búsqueda en O(1) por petición
  const manejadores = new Map(router.handlers.map((h) => [h.requestPath, createFetchHandler(h, { httpVersion: "1.1" })]));

  return async function atender(req: Request): Promise<Response> {
    const ruta = new URL(req.url).pathname.slice(prefijo.length);
    const manejador = manejadores.get(ruta);
    if (!manejador) return new Response(JSON.stringify({ code: "unimplemented", message: `No existe el método ${ruta}` }), { status: 404, headers: { "Content-Type": "application/json" } });
    return manejador(req);
  };
}

/** Rutas disponibles (para documentarlas o probarlas) */
export function metodosDe(rutas: (router: ConnectRouter) => void): string[] {
  const router = createConnectRouter();
  rutas(router);
  return router.handlers.map((h) => h.requestPath);
}
