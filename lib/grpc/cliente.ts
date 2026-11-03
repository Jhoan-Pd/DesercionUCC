import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { MotorRiesgoService } from "./gen/observatorio/riesgo/v1/motor_riesgo_pb";

/**
 * Cliente del motor de riesgo para el navegador. Habla gRPC-Web (mensajes Protobuf binarios con el
 * marco de 5 bytes de gRPC) contra /api/grpc; la cookie de sesión viaja sola por ser el mismo origen.
 * En la pestaña Red del navegador las peticiones aparecen como application/grpc-web+proto.
 */
export const motorRiesgo = createClient(MotorRiesgoService, createGrpcWebTransport({ baseUrl: "/api/grpc" }));
