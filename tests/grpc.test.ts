import { describe, expect, it, vi } from "vitest";
import { Code, createClient, createRouterTransport } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

// El servicio se prueba con dobles: ninguna prueba toca la base de datos
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { MotorRiesgo, rutasMotorRiesgo, aErrorConnect } = await import("@/services/grpc/MotorRiesgo");
const { crearServidorFetch, metodosDe } = await import("@/lib/grpc/servidor-fetch");
const { datosAProto, datosDesdeProto, nivelesDesde } = await import("@/lib/grpc/mapeo");
const { MotorRiesgoService, NivelRiesgo, MetodoRiesgo } = await import("@/lib/grpc/gen/observatorio/riesgo/v1/motor_riesgo_pb");
const { ErrorApi } = await import("@/lib/errores");
type ServicioEvaluacion = import("@/services/riesgo/ServicioEvaluacion").ServicioEvaluacion;
type ServicioEstudiantes = import("@/services/estudiantes/ServicioEstudiantes").ServicioEstudiantes;

const evaluacionFalsa = { modeloActivo: async () => null } as unknown as ServicioEvaluacion;
const fila = (i: number) => ({ codigo: `C${i}`, programa: "Derecho", semestre: 2, puntaje: 90 - i, nivel: "ALTO" as const, factores: ["Promedio acumulado"] });
const estudiantesFalsos = {
  resumen: async () => ({ activos: 3, nivel: { ALTO: 1, MEDIO: 1, BAJO: 1 }, programas: [{ programa: "Derecho", total: 3, ALTO: 1, MEDIO: 1, BAJO: 1 }], modelo: { metodo: "FACTORES" } }),
  async *recorrerEnRiesgo(_niveles: string[], limite: number) {
    for (let i = 0; i < limite; i++) yield fila(i);
  },
} as unknown as ServicioEstudiantes;

const motor = new MotorRiesgo(evaluacionFalsa, estudiantesFalsos);
type Autenticador = import("@/services/grpc/MotorRiesgo").Autenticador;
const siempre: Autenticador = async () => ({ id: "u1", descripcion: "prueba" });
const nunca: Autenticador = async () => null;
const clienteEnMemoria = (autenticar: Autenticador = siempre) => createClient(MotorRiesgoService, createRouterTransport(rutasMotorRiesgo(autenticar, motor)));

describe("servicio gRPC MotorRiesgo", () => {
  it("Evaluar (unario) usa el método vigente y devuelve los factores", async () => {
    const r = await clienteEnMemoria().evaluar({ datos: { semestre: 1, promedio: 2.5, materiasPerdidas: 3, moraMatricula: true } });
    expect(r.metodo).toBe(MetodoRiesgo.FACTORES);
    expect(r.nivel).toBe(NivelRiesgo.ALTO);
    expect(r.factores.map((f) => f.clave)).toContain("promedio");
    expect(r.faltantes).toContain("asistencia");
  });

  it("rechaza datos fuera de rango con INVALID_ARGUMENT, con los mismos rangos del archivo", async () => {
    await expect(clienteEnMemoria().evaluar({ datos: { semestre: 1, promedio: 7 } })).rejects.toMatchObject({ code: Code.InvalidArgument });
    await expect(clienteEnMemoria().evaluar({ datos: { semestre: 0 } })).rejects.toMatchObject({ code: Code.InvalidArgument });
  });

  it("sin credenciales responde UNAUTHENTICATED (interceptor)", async () => {
    await expect(clienteEnMemoria(nunca).obtenerResumen({})).rejects.toMatchObject({ code: Code.Unauthenticated });
  });

  it("ListarEnRiesgo (flujo del servidor) entrega los mensajes uno a uno y respeta el límite", async () => {
    const recibidos: string[] = [];
    for await (const m of clienteEnMemoria().listarEnRiesgo({ nivelMinimo: NivelRiesgo.ALTO, limite: 4 })) recibidos.push(m.estudiante!.codigo);
    expect(recibidos).toEqual(["C0", "C1", "C2", "C3"]);
    const flujo = clienteEnMemoria().listarEnRiesgo({ limite: 501 });
    await expect((async () => { for await (const _ of flujo) void _; })()).rejects.toMatchObject({ code: Code.InvalidArgument });
  });

  it("los errores de la aplicación se traducen a códigos gRPC y los inesperados no filtran detalles", () => {
    expect(aErrorConnect(new ErrorApi(409, "otra carga")).code).toBe(Code.Aborted);
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = aErrorConnect(new Error("password=secreto"));
    expect(e.code).toBe(Code.Internal);
    expect(e.message).not.toContain("secreto");
    espia.mockRestore();
  });
});

describe("adaptador para Next.js (Fetch API, protocolo Connect con Protobuf binario)", () => {
  const atender = crearServidorFetch(rutasMotorRiesgo(siempre, motor), "/api/grpc", { connect: true, grpcWeb: true, grpc: false });
  const transporte = createConnectTransport({ baseUrl: "http://localhost/api/grpc", useBinaryFormat: true, fetch: (entrada, init) => atender(new Request(entrada, init)) });

  it("atiende una llamada real de punta a punta por HTTP", async () => {
    const r = await createClient(MotorRiesgoService, transporte).obtenerResumen({});
    expect(r.activos).toBe(3);
    expect(r.programas[0].programa).toBe("Derecho");
  });

  it("publica los tres métodos del contrato y responde 404 a uno que no existe", async () => {
    expect(metodosDe(rutasMotorRiesgo(siempre, motor))).toEqual([
      "/observatorio.riesgo.v1.MotorRiesgoService/Evaluar",
      "/observatorio.riesgo.v1.MotorRiesgoService/ObtenerResumen",
      "/observatorio.riesgo.v1.MotorRiesgoService/ListarEnRiesgo",
    ]);
    expect((await atender(new Request("http://localhost/api/grpc/otro.Servicio/Metodo", { method: "POST" }))).status).toBe(404);
  });
});

describe("mapeo Protobuf <-> dominio", () => {
  it("un campo opcional ausente es un dato faltante (null), nunca 0", () => {
    const d = datosDesdeProto(datosAProto({ semestre: 3, promedio: 0, trabaja: false }));
    expect(d).toMatchObject({ semestre: 3, promedio: 0, trabaja: false, asistencia: null, estrato: null });
  });

  it("nivel mínimo: sin especificar = desde MEDIO", () => {
    expect(nivelesDesde(NivelRiesgo.UNSPECIFIED)).toEqual(["ALTO", "MEDIO"]);
    expect(nivelesDesde(NivelRiesgo.ALTO)).toEqual(["ALTO"]);
    expect(nivelesDesde(NivelRiesgo.BAJO)).toEqual(["ALTO", "MEDIO", "BAJO"]);
  });
});
