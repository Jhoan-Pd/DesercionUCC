import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { authOptions } from "@/lib/auth";
import type { Rol } from "@/lib/roles";

/** Error controlado de la API: se traduce a una respuesta JSON con el código HTTP indicado */
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

interface Contexto {
  req: Request;
  session: Session;
  /** Parámetros de la ruta dinámica (p. ej. { id } en /api/alertas/[id]) */
  params: Record<string, string>;
}

/**
 * Envuelve un handler de API con: autenticación, autorización por rol y manejo uniforme de errores.
 * Un solo lugar para esto evita repetir try/catch y deja las rutas cortas y legibles.
 * El handler devuelve un objeto (se envía como JSON) o un `Response` (se envía tal cual, p. ej. un archivo).
 */
export function manejar(roles: Rol[] | null, handler: (ctx: Contexto) => Promise<unknown>) {
  return async (req: Request, ruta?: { params?: Record<string, string> }): Promise<Response> => {
    try {
      const session = await getServerSession(authOptions);
      if (!session) throw new ErrorApi(401, "No autenticado. Inicia sesión para continuar.");
      if (session.revocada) throw new ErrorApi(401, "Tu cuenta fue desactivada. Comunícate con el administrador del observatorio.");
      if (roles && !roles.includes(session.user.rol)) throw new ErrorApi(403, "No tienes permisos para esta operación.");
      const resultado = await handler({ req, session, params: ruta?.params ?? {} });
      // Un handler puede devolver una respuesta ya armada (p. ej. un archivo PDF o Excel)
      if (resultado instanceof Response) return resultado;
      return NextResponse.json(resultado);
    } catch (error) {
      return respuestaDeError(error);
    }
  };
}

export function respuestaDeError(error: unknown): NextResponse {
  if (error instanceof ErrorApi) {
    return NextResponse.json({ error: error.message, detalles: error.detalles }, { status: error.estado });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Los datos enviados no son válidos.",
        detalles: error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
      },
      { status: 400 },
    );
  }
  console.error("[API] Error no controlado:", error);
  return NextResponse.json({ error: "Ocurrió un error inesperado. Intenta de nuevo más tarde." }, { status: 500 });
}

/** Valida el cuerpo JSON de la petición con un esquema Zod */
export async function leerJson<T extends ZodTypeAny>(req: Request, esquema: T): Promise<z.infer<T>> {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    throw new ErrorApi(400, "El cuerpo de la petición no es un JSON válido.");
  }
  return esquema.parse(cuerpo);
}

/** Valida los parámetros de la URL (query string) con un esquema Zod */
export function leerQuery<T extends ZodTypeAny>(req: Request, esquema: T): z.infer<T> {
  const { searchParams } = new URL(req.url);
  const objeto: Record<string, string> = {};
  searchParams.forEach((valor, clave) => {
    if (valor !== "") objeto[clave] = valor;
  });
  return esquema.parse(objeto);
}
