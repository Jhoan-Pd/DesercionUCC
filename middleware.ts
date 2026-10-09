import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { esRol } from "@/lib/roles";
import { puedeAcceder } from "@/lib/rbac";

/**
 * Middleware de protección de rutas por rol (corre en el Edge, antes de renderizar).
 * - Sin sesión: páginas -> /login ; API -> 401 JSON.
 * - Con sesión pero sin permiso: páginas -> /acceso-denegado ; API -> 403 JSON.
 * Defensa en profundidad: además, cada endpoint de la API vuelve a validar el rol.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esApi = pathname.startsWith("/api");
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !esRol(token.rol)) {
    if (esApi) return NextResponse.json({ error: "No autenticado. Inicia sesión para continuar." }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (!puedeAcceder(pathname, token.rol)) {
    if (esApi) return NextResponse.json({ error: "No tienes permisos para esta operación." }, { status: 403 });
    return NextResponse.redirect(new URL("/acceso-denegado", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/calculadora/:path*",
    "/alerta-temprana/:path*",
    "/intervenciones/:path*",
    "/impacto-institucional/:path*",
    "/panel-docente/:path*",
    "/encuesta/:path*",
    "/reportes/:path*",
    "/admin/:path*",
    "/api/dashboard/:path*",
    "/api/impacto/:path*",
    "/api/parametros/:path*",
    "/api/riesgo/:path*",
    "/api/alertas/:path*",
    "/api/encuesta/:path*",
    "/api/docente/:path*",
  ],
};
