import type { NivelRiesgo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { claveNombre, resumenUccPasto } from "@/lib/datos-abiertos";
import { ServicioEstudiantes, factoresDe } from "@/services/estudiantes/ServicioEstudiantes";
import type { Herramientas } from "./declaraciones";

/**
 * Herramientas que el agente consulta: leen la información REAL del sistema (estudiantes cargados y
 * cifras oficiales). Ninguna devuelve nombres, documentos ni datos de contacto.
 */
const NIVELES = new Set(["ALTO", "MEDIO", "BAJO"]);

/** Implementación real sobre la base de datos */
export class HerramientasBD implements Herramientas {
  async ejecutar(nombre: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (nombre) {
      case "resumen_riesgo":
        return this.resumen();
      case "buscar_estudiantes":
        return this.buscar(args);
      case "detalle_estudiante":
        return this.detalle(String(args.codigo ?? ""));
      case "cifras_oficiales_ucc":
        return this.cifras();
      default:
        return { error: `Herramienta desconocida: ${nombre}` };
    }
  }

  private async resumen() {
    const r = await new ServicioEstudiantes().resumen();
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
    const nivel = typeof args.nivel === "string" && NIVELES.has(args.nivel.toUpperCase()) ? (args.nivel.toUpperCase() as NivelRiesgo) : undefined;
    const programa = typeof args.programa === "string" ? claveNombre(args.programa) : "";
    const semestreMax = Number.isFinite(Number(args.semestre_maximo)) ? Number(args.semestre_maximo) : undefined;
    const factor = typeof args.factor === "string" ? claveNombre(args.factor) : "";
    const limite = Math.min(50, Math.max(1, Number(args.limite) || 15));

    const filas = await prisma.estudiante.findMany({
      where: { estado: "ACTIVO", evaluacion: nivel ? { nivel } : { isNot: null }, ...(semestreMax ? { semestre: { lte: semestreMax } } : {}) },
      select: { codigo: true, programa: true, semestre: true, evaluacion: { select: { puntaje: true, nivel: true, factores: true } } },
      orderBy: { evaluacion: { puntaje: "desc" } },
    });
    const coincidencias = filas
      .filter((e) => !programa || claveNombre(e.programa).includes(programa))
      .map((e) => ({ codigo: e.codigo, programa: e.programa, semestre: e.semestre, puntaje: e.evaluacion!.puntaje, nivel: e.evaluacion!.nivel, factores: factoresDe(e.evaluacion!.factores).map((f) => f.etiqueta) }))
      .filter((e) => !factor || e.factores.some((f) => claveNombre(f).includes(factor)));
    return { total: coincidencias.length, mostrados: Math.min(limite, coincidencias.length), estudiantes: coincidencias.slice(0, limite) };
  }

  private async detalle(codigo: string) {
    const d = await new ServicioEstudiantes().detalle(codigo.trim());
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
