import { prisma } from "@/lib/prisma";
import { resumenUccPasto } from "@/lib/datos-abiertos";
import { claveNombre } from "@/lib/texto";
import { memorizar } from "@/lib/utils";
import { ServicioEstudiantes } from "@/services/estudiantes/ServicioEstudiantes";
import { factoresDe } from "@/services/riesgo/persistencia";
import { esNivel } from "@/services/riesgo/niveles";
import { DECLARACIONES, esNombreHerramienta, type Herramientas, type NombreHerramienta } from "./declaraciones";

/**
 * Herramientas que el agente consulta: leen la información REAL del sistema (estudiantes cargados y
 * cifras oficiales). Ninguna devuelve nombres, documentos ni datos de contacto.
 */

/** Función que atiende una herramienta con los argumentos que envía el modelo de IA */
type Ejecutor = (args: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;

/** Implementación real sobre la base de datos */
export class HerramientasBD implements Herramientas {
  readonly declaraciones = DECLARACIONES;

  /**
   * Registro nombre -> ejecutor (patrón Command). Al ser un Record<NombreHerramienta, …>, TypeScript
   * exige un ejecutor por cada herramienta declarada: no puede quedar una sin implementar.
   */
  private readonly ejecutores: Readonly<Record<NombreHerramienta, Ejecutor>> = {
    resumen_riesgo: () => this.resumen(),
    buscar_estudiantes: (args) => this.buscar(args),
    detalle_estudiante: (args) => this.detalle(String(args.codigo ?? "")),
    cifras_oficiales_ucc: () => this.cifras(),
  };

  constructor(private readonly estudiantes: ServicioEstudiantes = new ServicioEstudiantes()) {}

  async ejecutar(nombre: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!esNombreHerramienta(nombre)) return { error: `Herramienta desconocida: ${nombre}` };
    return this.ejecutores[nombre](args);
  }

  private async resumen() {
    const r = await this.estudiantes.resumen();
    if (r.activos === 0) return { estudiantesActivos: 0, aviso: "No hay estudiantes cargados. El administrador debe subir el archivo de estudiantes en la página «Cargar datos»." };
    return {
      estudiantesActivos: r.activos,
      porNivel: r.nivel,
      porPrograma: r.programas,
      factoresMasFrecuentesEnRiesgoMedioYAlto: r.factores,
      estudiantesConResultadoConocido: r.conResultado,
      metodo: r.modelo.metodo === "MODELO" ? "Modelo entrenado con estudiantes de la UCC" : "Puntaje por factores (criterio experto MEN-SPADIES)",
      detalleMetodo: r.modelo.motivo,
      ultimaCarga: r.ultimaCarga ? { archivo: r.ultimaCarga.archivo, fecha: r.ultimaCarga.fecha } : null,
    };
  }

  private async buscar(args: Record<string, unknown>) {
    const pedido = typeof args.nivel === "string" ? args.nivel.toUpperCase() : null;
    const nivel = esNivel(pedido) ? pedido : undefined;
    const programa = typeof args.programa === "string" ? claveNombre(args.programa) : "";
    const semestreMax = Number.isFinite(Number(args.semestre_maximo)) ? Number(args.semestre_maximo) : undefined;
    const factor = typeof args.factor === "string" ? claveNombre(args.factor) : "";
    const limite = Math.min(50, Math.max(1, Number(args.limite) || 15));

    // El programa se compara sin tildes, algo que PostgreSQL no hace con ILIKE: se buscan primero los
    // pocos programas que coinciden (uno por nombre distinto) y luego se filtra en la consulta con IN.
    const programas = programa ? (await this.estudiantes.programas()).filter((p) => claveNombre(p).includes(programa)) : null;
    if (programas?.length === 0) return { total: 0, mostrados: 0, estudiantes: [] };

    const filas = await prisma.estudiante.findMany({
      where: {
        estado: "ACTIVO",
        evaluacion: nivel ? { nivel } : { isNot: null },
        ...(semestreMax ? { semestre: { lte: semestreMax } } : {}),
        ...(programas ? { programa: { in: programas } } : {}),
      },
      select: { codigo: true, programa: true, semestre: true, evaluacion: { select: { puntaje: true, nivel: true, factores: true } } },
      orderBy: { evaluacion: { puntaje: "desc" } },
    });
    // Las etiquetas de factor se repiten mucho: se normaliza cada una una sola vez
    const claveFactor = memorizar(claveNombre);
    const coincidencias = filas
      .map((e) => ({ codigo: e.codigo, programa: e.programa, semestre: e.semestre, puntaje: e.evaluacion!.puntaje, nivel: e.evaluacion!.nivel, factores: factoresDe(e.evaluacion!.factores).map((f) => f.etiqueta) }))
      .filter((e) => !factor || e.factores.some((f) => claveFactor(f).includes(factor)));
    return { total: coincidencias.length, mostrados: Math.min(limite, coincidencias.length), estudiantes: coincidencias.slice(0, limite) };
  }

  private async detalle(codigo: string) {
    const d = await this.estudiantes.detalle(codigo.trim());
    if (!d) return { error: `No existe un estudiante con el código ${codigo}.` };
    return {
      codigo: d.codigo,
      programa: d.programa,
      estado: d.estado,
      periodo: d.periodo,
      datos: d.datos,
      evaluacion: d.evaluacion
        ? { puntaje: d.evaluacion.puntaje, nivel: d.evaluacion.nivel, metodo: d.evaluacion.metodo, factores: d.evaluacion.factores.map((f) => ({ factor: f.etiqueta, puntos: f.puntos, detalle: f.detalle })), datosFaltantes: d.evaluacion.faltantes }
        : null,
    };
  }

  private cifras() {
    const r = resumenUccPasto();
    return {
      fuente: `${r.fuentes.matricula.publica} — ${r.fuentes.matricula.nombre} (${r.fuentes.matricula.url}), actualizado ${r.fuentes.matricula.actualizado}`,
      nota: r.nota,
      matriculaPastoPorAnio: r.porAnio,
      variacionPasto: r.variacionPasto,
      matriculaNacionalUccPorAnio: r.nacional,
      anioSedes: r.anioCampus,
      posicionPastoEntreSedes: r.posicionPasto,
      sedes: r.campus,
      programasPasto: r.programas.map((p) => ({ programa: p.programa, nivel: p.nivel, matriculados: p.total, hombres: p.hombres, mujeres: p.mujeres, matriculados2015: p.totalInicial })),
      programasActivosPasto: r.programasActivos.map((p) => `${p.titulo} (${p.nivelAcademico}, ${p.registro})`),
    };
  }
}
