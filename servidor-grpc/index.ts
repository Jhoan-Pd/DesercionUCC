/**
 * Servidor gRPC independiente del motor de riesgo (HTTP/2).
 *
 *   npm run grpc:servidor            # escucha en 0.0.0.0:50051 (GRPC_PUERTO)
 *
 * Atiende el MISMO servicio que /api/grpc en Next.js, pero sobre HTTP/2, así que además de Connect y
 * gRPC-Web habla gRPC «puro»: lo puede llamar cualquier cliente gRPC (grpcurl, Postman, Go, Python…).
 * Como no hay cookies de sesión, la autenticación es un token en la metadata:
 *   authorization: Bearer <GRPC_TOKEN>
 * Usa la misma base de datos que la aplicación (DATABASE_URL).
 */
import http2 from "node:http2";
import { timingSafeEqual } from "node:crypto";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { rutasMotorRiesgo, type Autenticador } from "@/services/grpc/MotorRiesgo";

const PUERTO = Number(process.env.GRPC_PUERTO ?? 50051);
const TOKEN = process.env.GRPC_TOKEN ?? "";
/** Un token corto se adivina: se exige uno largo y aleatorio (p. ej. `openssl rand -hex 24`) */
const LARGO_MINIMO_TOKEN = 24;

if (TOKEN.length < LARGO_MINIMO_TOKEN) {
  console.error(`Define GRPC_TOKEN con al menos ${LARGO_MINIMO_TOKEN} caracteres (por ejemplo: openssl rand -hex 24).`);
  process.exit(1);
}

/** Compara en tiempo constante para no filtrar el token por tiempos de respuesta */
function tokenValido(recibido: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const porToken: Autenticador = async (cabeceras) => {
  const [tipo, valor] = (cabeceras.get("authorization") ?? "").split(" ");
  return tipo === "Bearer" && valor && tokenValido(valor) ? { id: "token", descripcion: "cliente gRPC con token" } : null;
};

const manejador = connectNodeAdapter({ routes: rutasMotorRiesgo(porToken), grpc: true, grpcWeb: true, connect: true, readMaxBytes: 64 * 1024 });

http2.createServer(manejador).listen(PUERTO, () => {
  console.log(`Motor de riesgo gRPC escuchando en http://localhost:${PUERTO} (gRPC, gRPC-Web y Connect sobre HTTP/2 sin TLS)`);
});
