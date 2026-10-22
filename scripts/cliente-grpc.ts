/**
 * Cliente gRPC de ejemplo (para la sustentación y para probar el servidor).
 *
 *   GRPC_TOKEN=... npm run grpc:cliente                 # contra http://localhost:50051
 *   GRPC_URL=http://otro:50051 GRPC_TOKEN=... npm run grpc:cliente
 *
 * Usa el protocolo gRPC de verdad (HTTP/2, mensajes Protobuf binarios con encabezado de 5 bytes y
 * estado en los trailers) y muestra los tres tipos de llamada del servicio: dos unarias y una de flujo.
 */
import { createClient, type Interceptor } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { MotorRiesgoService, NivelRiesgo } from "@/lib/grpc/gen/observatorio/riesgo/v1/motor_riesgo_pb";

const URL_BASE = process.env.GRPC_URL ?? "http://localhost:50051";
const TOKEN = process.env.GRPC_TOKEN ?? "";

/** Agrega el token a la metadata de cada llamada */
const conToken: Interceptor = (siguiente) => (peticion) => {
  peticion.header.set("authorization", `Bearer ${TOKEN}`);
  return siguiente(peticion);
};

const cliente = createClient(MotorRiesgoService, createGrpcTransport({ baseUrl: URL_BASE, interceptors: [conToken] }));

async function main() {
  console.log(`→ ObtenerResumen (${URL_BASE})`);
  const resumen = await cliente.obtenerResumen({});
  console.log(`  ${resumen.activos} activos: ${resumen.alto} alto, ${resumen.medio} medio, ${resumen.bajo} bajo`);

  console.log("→ Evaluar (estudiante hipotético de 2.º semestre, promedio 2,7, 2 materias perdidas, con mora)");
  const r = await cliente.evaluar({ datos: { semestre: 2, promedio: 2.7, materiasPerdidas: 2, moraMatricula: true } });
  console.log(`  puntaje ${r.puntaje} · nivel ${NivelRiesgo[r.nivel]} · factores: ${r.factores.map((f) => f.etiqueta).join(", ")}`);

  console.log("→ ListarEnRiesgo (flujo: cada línea llega por separado)");
  let n = 0;
  for await (const m of cliente.listarEnRiesgo({ nivelMinimo: NivelRiesgo.ALTO, limite: 10 })) {
    const e = m.estudiante;
    if (e) console.log(`  #${++n} ${e.codigo} · ${e.programa} · ${e.puntaje} pts · ${e.factores.join(", ")}`);
  }
  console.log(`  fin del flujo (${n} estudiantes)`);
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
