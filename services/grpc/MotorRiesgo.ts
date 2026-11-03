import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, type HandlerContext, type Interceptor, type ServiceImpl } from "@connectrpc/connect";
import { ServicioEstudiantes } from "@/services/estudiantes/ServicioEstudiantes";
import { ServicioEvaluacion } from "@/services/riesgo/ServicioEvaluacion";
import { crearCalculadora } from "@/services/riesgo/calculadora";
import { problemasDeRango } from "@/services/carga/lector";
import { ErrorApi } from "@/lib/errores";
import { datosDesdeProto, metodoAProto, nivelAProto, nivelesDesde, resultadoAProto } from "@/lib/grpc/mapeo";
import {
  ListarEnRiesgoResponseSchema,
  MotorRiesgoService,
  ObtenerResumenResponseSchema,
  type EvaluarRequest,
  type ListarEnRiesgoRequest,
} from "@/lib/grpc/gen/observatorio/riesgo/v1/motor_riesgo_pb";

/** Quien llama al servicio, ya autenticado. Cada servidor decide cómo se autentica (sesión o token). */
export interface Llamante {
  id: string;
  descripcion: string;
}

/** Devuelve el llamante a partir de las cabeceras (metadata gRPC) o null si no está autenticado */
export type Autenticador = (cabeceras: Headers) => Promise<Llamante | null>;

export const LIMITE_LISTA = { porDefecto: 100, maximo: 500 } as const;

/**
 * Interceptor de autenticación (el equivalente gRPC de un middleware): corre antes de cada método,
 * unario o de flujo, y corta la llamada con UNAUTHENTICATED si no hay credenciales válidas.
 */
export function interceptorAutenticacion(autenticar: Autenticador): Interceptor {
  return (siguiente) => async (peticion) => {
    const llamante = await autenticar(peticion.header);
    if (!llamante) throw new ConnectError("Inicia sesión (o envía un token válido) para usar el motor de riesgo.", Code.Unauthenticated);
    return siguiente(peticion);
  };
}

/** Código gRPC equivalente a cada estado HTTP de los errores controlados de la aplicación */
const CODIGO_POR_ESTADO: Readonly<Record<number, Code>> = {
  400: Code.InvalidArgument,
  401: Code.Unauthenticated,
  403: Code.PermissionDenied,
  404: Code.NotFound,
  409: Code.Aborted,
  413: Code.ResourceExhausted,
  422: Code.FailedPrecondition,
  429: Code.ResourceExhausted,
};

/** Traduce cualquier error a un ConnectError; los inesperados se registran y no se filtran al cliente */
export function aErrorConnect(error: unknown): ConnectError {
  if (error instanceof ConnectError) return error;
  if (error instanceof ErrorApi) return new ConnectError(error.message, CODIGO_POR_ESTADO[error.estado] ?? Code.Unknown);
  console.error("[gRPC] Error no controlado:", error);
  return new ConnectError("Ocurrió un error inesperado en el motor de riesgo.", Code.Internal);
}

/**
 * Interceptor de errores: lo mismo que respuestaDeError() en las rutas REST, pero para gRPC.
 * En un método de flujo el error puede aparecer a mitad del envío, así que también se envuelve
 * el iterable de mensajes.
 */
export const interceptorErrores: Interceptor = (siguiente) => async (peticion) => {
  try {
    const respuesta = await siguiente(peticion);
    if (!respuesta.stream) return respuesta;
    const mensajes = respuesta.message;
    return {
      ...respuesta,
      message: (async function* () {
        try {
          yield* mensajes;
        } catch (e) {
          throw aErrorConnect(e);
        }
      })(),
    };
  } catch (e) {
    throw aErrorConnect(e);
  }
};

/**
 * Implementación del servicio MotorRiesgo (contrato: proto/observatorio/riesgo/v1/motor_riesgo.proto).
 * No sabe nada del transporte: la misma clase atiende Connect y gRPC-Web dentro de Next.js y gRPC
 * puro en el servidor HTTP/2. Reutiliza los servicios del dominio (inyectados por constructor).
 */
export class MotorRiesgo implements ServiceImpl<typeof MotorRiesgoService> {
  constructor(
    private readonly evaluacion: ServicioEvaluacion = new ServicioEvaluacion(),
    private readonly estudiantes: ServicioEstudiantes = new ServicioEstudiantes(),
  ) {}

  /** Unario: riesgo de unos datos con el método vigente, sin guardar nada */
  async evaluar(req: EvaluarRequest) {
    const datos = datosDesdeProto(req.datos);
    const problemas = problemasDeRango(datos);
    if (problemas.length > 0) throw new ConnectError(problemas.join("; "), Code.InvalidArgument);
    const calculadora = crearCalculadora(await this.evaluacion.modeloActivo());
    return resultadoAProto(calculadora.evaluar(datos));
  }

  /** Unario: conteo por nivel y programa */
  async obtenerResumen() {
    const r = await this.estudiantes.resumen();
    return create(ObtenerResumenResponseSchema, {
      activos: r.activos,
      alto: r.nivel.ALTO,
      medio: r.nivel.MEDIO,
      bajo: r.nivel.BAJO,
      metodo: metodoAProto(r.modelo.metodo),
      programas: r.programas.map((p) => ({ programa: p.programa, total: p.total, alto: p.ALTO, medio: p.MEDIO, bajo: p.BAJO })),
    });
  }

  /** Flujo del servidor: cada estudiante se envía apenas se lee de la base (y se detiene si el cliente corta) */
  async *listarEnRiesgo(req: ListarEnRiesgoRequest, ctx: HandlerContext) {
    const limite = req.limite === 0 ? LIMITE_LISTA.porDefecto : req.limite;
    if (limite > LIMITE_LISTA.maximo) throw new ConnectError(`El límite máximo es ${LIMITE_LISTA.maximo}.`, Code.InvalidArgument);
    for await (const e of this.estudiantes.recorrerEnRiesgo(nivelesDesde(req.nivelMinimo), limite, ctx.signal)) {
      yield create(ListarEnRiesgoResponseSchema, { estudiante: { ...e, nivel: e.nivel ? nivelAProto(e.nivel) : undefined, puntaje: e.puntaje ?? 0 } });
    }
  }
}

/** Registra el servicio en un router de Connect con su interceptor de autenticación */
export function rutasMotorRiesgo(autenticar: Autenticador, motor: MotorRiesgo = new MotorRiesgo()) {
  // El primero de la lista es el más externo: los errores de autenticación también pasan por él
  return (router: ConnectRouter) => router.service(MotorRiesgoService, motor, { interceptors: [interceptorErrores, interceptorAutenticacion(autenticar)] });
}
