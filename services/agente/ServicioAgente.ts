import { ErrorApi } from "@/lib/errores";
import { ClienteGemini, ErrorIA } from "@/lib/ia/gemini";
import { ServicioEstudiantes, type EstudianteMencionado } from "@/services/estudiantes/ServicioEstudiantes";
import { Agente, type MensajeChat } from "./Agente";
import type { Herramientas } from "./declaraciones";
import { HerramientasBD } from "./herramientas";

export type { EstudianteMencionado };

export interface RespuestaChat {
  respuesta: string;
  modelo: string;
  herramientas: string[];
  /** Estudiantes que aparecen en la respuesta, con su nombre para quien tiene permiso de verlo */
  estudiantes: EstudianteMencionado[];
}

/**
 * Caso de uso «preguntar al agente»: arma el agente con el cliente de Gemini y las herramientas,
 * traduce los errores de la IA a errores de la API y agrega el nombre de los estudiantes mencionados
 * (Gemini solo conoce sus códigos). La ruta /api/agente queda reducida a validar la entrada.
 */
export class ServicioAgente {
  constructor(
    private readonly cliente: ClienteGemini | null = ClienteGemini.desdeEntorno(),
    private readonly herramientas: Herramientas = new HerramientasBD(),
    private readonly estudiantes: ServicioEstudiantes = new ServicioEstudiantes(),
  ) {}

  get disponible(): boolean {
    return this.cliente !== null;
  }

  async preguntar(pregunta: string, historial: MensajeChat[]): Promise<RespuestaChat> {
    if (!this.cliente) throw new ErrorApi(503, "El agente de IA no está configurado: falta la variable GEMINI_API_KEY en el servidor.");
    try {
      const r = await new Agente(this.cliente, this.herramientas).responder(pregunta, historial);
      return { respuesta: r.respuesta, modelo: r.modelo, herramientas: r.herramientas, estudiantes: await this.estudiantes.mencionados(r.codigos) };
    } catch (e) {
      if (e instanceof ErrorIA) throw new ErrorApi(e.estado, e.message);
      throw e;
    }
  }
}
