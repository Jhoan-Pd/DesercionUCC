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
  // La ruta viaja al layout para que vuelva a verificar el permiso con el rol ACTUAL de la BD
  // (el rol del token puede estar desactualizado si el administrador lo cambió)
  const cabeceras = new Headers(req.headers);
  cabeceras.set("x-ruta", pathname);
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: [
    "/inicio/:path*",
    "/estudiantes/:path*",
    "/agente/:path*",
    "/cifras-ucc/:path*",
    "/cargar/:path*",
    "/usuarios/:path*",
    "/api/estudiantes/:path*",
    "/api/agente/:path*",
    "/api/cargas/:path*",
    "/api/usuarios/:path*",
  ],
};
