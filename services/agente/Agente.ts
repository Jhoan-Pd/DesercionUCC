import { ClienteGemini, ErrorIA, textoDe, type ContenidoGemini, type ParteGemini } from "@/lib/ia/gemini";
import { DECLARACIONES, type Herramientas } from "./declaraciones";

export interface MensajeChat {
  rol: "usuario" | "agente";
  texto: string;
}

export interface RespuestaAgente {
  respuesta: string;
  /** Códigos de estudiante que aparecen en la respuesta (para enlazar a sus fichas) */
  codigos: string[];
  herramientas: string[];
  modelo: string;
}

export const MAX_RONDAS = 5;
export const MAX_HISTORIAL = 10;

export function sistemaAgente(hoy: Date = new Date()): string {
  const fecha = hoy.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
  return `Eres el agente del Observatorio de Deserción de la Universidad Cooperativa de Colombia (UCC), sede Pasto. Ayudas al equipo de Bienestar Universitario a identificar estudiantes que podrían retirarse y a decidir cómo acompañarlos. Hoy es ${fecha}.

Reglas:
- Consulta las herramientas antes de responder sobre estudiantes o cifras. Usa SOLO lo que ellas devuelven: nunca inventes estudiantes, cifras, porcentajes ni causas.
- Si no hay estudiantes cargados, dilo y explica que el administrador debe subir el archivo en «Cargar datos».
- Los estudiantes se identifican por su código; no conoces sus nombres (protección de datos personales, Ley 1581 de 2012). Escribe los códigos tal como vienen.
- El nivel de riesgo es una alerta para ofrecer acompañamiento, no una predicción segura ni un juicio sobre la persona. Cuando sea relevante, aclara el método vigente: «puntaje por factores» (criterio experto basado en los factores del MEN-SPADIES) o «modelo entrenado con estudiantes de la UCC».
- Las cifras oficiales (datos.gov.co) son agregadas: matrícula por programa, sexo y año hasta 2021. No dicen nada de estudiantes individuales ni de tasas de deserción; no las presentes como si lo hicieran.
- Si sugieres acciones, que sean propias de Bienestar: tutorías o monitorías, consejería académica, orientación sobre becas, créditos o acuerdos de pago, acompañamiento psicológico, seguimiento de asistencia, acompañamiento de primer año.
- Responde en español, breve y claro. Usa viñetas (•) para listas. No uses tablas ni encabezados con #.`;
}

/** Códigos de estudiantes conocidos que aparecen en el texto */
export function codigosMencionados(texto: string, conocidos: Set<string>): string[] {
  const encontrados: string[] = [];
  for (const token of texto.match(/[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]|\d/g) ?? []) {
    if (conocidos.has(token) && !encontrados.includes(token)) encontrados.push(token);
  }
  return encontrados;
}

/** Recorre recursivamente una respuesta de herramienta y junta los códigos de estudiante */
function recogerCodigos(valor: unknown, destino: Set<string>): void {
  if (Array.isArray(valor)) valor.forEach((v) => recogerCodigos(v, destino));
  else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) {
      if (k === "codigo" && typeof v === "string") destino.add(v);
      else recogerCodigos(v, destino);
    }
  }
}

/**
 * Agente conversacional con llamadas a funciones (function calling):
 * Gemini decide qué herramienta consultar, el servidor la ejecuta contra la base de datos y le
 * devuelve el resultado, hasta que Gemini redacta la respuesta final (máximo MAX_RONDAS consultas).
 */
export class Agente {
  constructor(
    private readonly cliente: ClienteGemini,
    private readonly herramientas: Herramientas,
  ) {}

  async responder(pregunta: string, historial: MensajeChat[] = []): Promise<RespuestaAgente> {
    const contenidos: ContenidoGemini[] = historial.slice(-MAX_HISTORIAL).map((m) => ({ role: m.rol === "usuario" ? "user" : "model", parts: [{ text: m.texto }] }));
    contenidos.push({ role: "user", parts: [{ text: pregunta }] });

    const usadas: string[] = [];
    const codigosVistos = new Set<string>();
    for (let ronda = 0; ronda <= MAX_RONDAS; ronda++) {
      const partes = await this.cliente.generar({ sistema: sistemaAgente(), contenidos, funciones: ronda < MAX_RONDAS ? DECLARACIONES : undefined });
      const llamadas = partes.filter((p): p is ParteGemini & { functionCall: NonNullable<ParteGemini["functionCall"]> } => Boolean(p.functionCall));
      if (llamadas.length === 0) {
        const respuesta = textoDe(partes);
        if (!respuesta) throw new ErrorIA("El agente no generó una respuesta. Intenta reformular la pregunta.", 502);
        return { respuesta, codigos: codigosMencionados(respuesta, codigosVistos), herramientas: usadas, modelo: this.cliente.nombreModelo };
      }
      // Se devuelve al modelo su propio turno tal cual (incluye la firma de las llamadas)
      contenidos.push({ role: "model", parts: partes });
      const respuestas: ParteGemini[] = [];
      for (const llamada of llamadas) {
        usadas.push(llamada.functionCall.name);
        let resultado: Record<string, unknown>;
        try {
          resultado = await this.herramientas.ejecutar(llamada.functionCall.name, llamada.functionCall.args ?? {});
        } catch (e) {
          console.error("[agente] Error en herramienta", llamada.functionCall.name, e);
          resultado = { error: "No se pudo consultar esta información." };
        }
        recogerCodigos(resultado, codigosVistos);
        respuestas.push({ functionResponse: { name: llamada.functionCall.name, response: resultado } });
      }
      contenidos.push({ role: "user", parts: respuestas });
    }
    throw new ErrorIA("El agente necesitó demasiadas consultas para responder. Haz una pregunta más concreta.", 422);
  }
}
