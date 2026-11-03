import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { crearServidorFetch } from "@/lib/grpc/servidor-fetch";
import { rutasMotorRiesgo, type Autenticador } from "@/services/grpc/MotorRiesgo";

/**
 * Servicio gRPC MotorRiesgo publicado dentro de Next.js con los protocolos Connect y gRPC-Web.
 * Corre sobre HTTP/1.1, así que funciona en Vercel; el gRPC «puro» (HTTP/2 con trailers) lo atiende
 * el servidor de servidor-grpc/. El navegador lo llama con @connectrpc/connect-web (Protobuf binario).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Autenticación con la sesión de Auth.js (cookie), revalidada contra la base de datos */
const porSesion: Autenticador = async () => {
  const sesion = await getServerSession(authOptions);
  if (!sesion || sesion.revocada) return null;
  return { id: sesion.user.id, descripcion: `${sesion.user.rol} ${sesion.user.email ?? ""}`.trim() };
};

const atender = crearServidorFetch(rutasMotorRiesgo(porSesion), "/api/grpc", {
  connect: true,
  grpcWeb: true,
  // gRPC puro necesita HTTP/2 de punta a punta (trailers): lo atiende el servidor independiente
  grpc: false,
  // Las peticiones del simulador son de pocos bytes: cualquier cosa mucho mayor se rechaza
  readMaxBytes: 64 * 1024,
});

export const POST = (req: Request) => atender(req);
