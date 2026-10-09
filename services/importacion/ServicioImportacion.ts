import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { Rol } from "@/lib/roles";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { ServicioParametros } from "@/services/parametros/ServicioParametros";
import { ServicioRiesgo } from "@/services/riesgo/ServicioRiesgo";
import { COLUMNAS, ImportadorCSV, type CatalogosImportacion, type EstudianteImportado, type ResultadoAnalisis } from "./ImportadorCSV";

export interface VistaPrevia extends ResultadoAnalisis {
  nuevos: number;
  actualizados: number;
  /** Primeros estudiantes del archivo, sin nombres (solo para confirmar que se leyó bien) */
  muestra: { codigo: string; programa: string; cohorte: string; estado: string; semestres: number; existe: boolean }[];
}

export interface ResultadoImportacion {
  importacionId: string;
  filas: number;
  estudiantesNuevos: number;
  estudiantesActualizados: number;
  semestres: number;
  desertores: number;
  /** Recalculo de puntajes de riesgo tras importar (null si no se pudo, p. ej. sin periodo activo) */
  riesgo: { estudiantes: number; alto: number; alertasNuevas: number } | null;
}

interface Usuario {
  usuarioId: string;
  rol: Rol;
}

/** Identificador anónimo de un estudiante importado (mismo formato que el de los datos sintéticos) */
export function hashAnonimoImportado(codigo: string): string {
  const sal = process.env.HASH_ANONIMO_SAL ?? "observatorio-ucc";
  return `EST-${createHash("sha256").update(`${codigo}:${sal}`).digest("hex").slice(0, 10)}`;
}

/**
 * Importación de estudiantes reales desde CSV (solo ADMIN).
 * El servidor SIEMPRE vuelve a validar el archivo completo con ImportadorCSV antes de escribir.
 * Cada estudiante del archivo reemplaza su trayectoria completa (matrículas, notas, financiación
 * y retiro) dentro de una sola transacción: o se importa todo el archivo o nada.
 */
export class ServicioImportacion {
  private async catalogos() {
    const [programas, periodos, causas] = await Promise.all([
      prisma.programa.findMany({ select: { id: true, nombre: true, valorSemestre: true } }),
      prisma.periodo.findMany({ select: { id: true, codigo: true, anio: true, fechaFin: true } }),
      prisma.causaDesercion.findMany({ select: { id: true, nombre: true } }),
    ]);
    const nombres: CatalogosImportacion = {
      programas: programas.map((p) => p.nombre),
      periodos: periodos.map((p) => p.codigo),
      causas: causas.map((c) => c.nombre),
    };
    return { programas, periodos, causas, nombres };
  }

  async vistaPrevia(contenido: string): Promise<VistaPrevia> {
    const { nombres } = await this.catalogos();
    const analisis = new ImportadorCSV(nombres).analizar(contenido);
    const codigos = analisis.estudiantes.map((e) => e.codigo);
    const existentes = new Set(
      codigos.length ? (await prisma.estudiante.findMany({ where: { codigo: { in: codigos } }, select: { codigo: true } })).map((e) => e.codigo) : [],
    );
    return {
      ...analisis,
      nuevos: codigos.filter((c) => !existentes.has(c)).length,
      actualizados: codigos.filter((c) => existentes.has(c)).length,
      muestra: analisis.estudiantes.slice(0, 10).map((e) => ({
        codigo: e.codigo,
        programa: e.programa,
        cohorte: e.cohorte,
        estado: e.estado,
        semestres: e.semestres.length,
        existe: existentes.has(e.codigo),
      })),
    };
  }

  async importar(archivo: string, contenido: string, usuario: Usuario): Promise<ResultadoImportacion> {
    const cat = await this.catalogos();
    const analisis = new ImportadorCSV(cat.nombres).analizar(contenido);
    if (!analisis.valido) {
      throw new ErrorApi(400, `El archivo tiene ${analisis.totalErrores} error(es); no se importó nada.`, analisis.errores.slice(0, 50));
    }

    const programaPorNombre = new Map(cat.programas.map((p) => [p.nombre, p]));
    const periodoPorCodigo = new Map(cat.periodos.map((p) => [p.codigo, p]));
    const causaPorNombre = new Map(cat.causas.map((c) => [c.nombre, c.id]));
    const parametros = await new ServicioParametros().mapa();
    const tasa = { ICETEX: (parametros["tasa_icetex_ea"] ?? 11) / 100, CREDITO_UCC: (parametros["tasa_credito_ucc_ea"] ?? 14) / 100 };
    const plazo = parametros["plazo_amortizacion_meses"] ?? 60;

    const estudiantes = analisis.estudiantes;
    const resultado = await prisma.$transaction(
      async (tx) => {
        const existentes = new Map(
          (await tx.estudiante.findMany({ where: { codigo: { in: estudiantes.map((e) => e.codigo) } }, select: { id: true, codigo: true } })).map((e) => [e.codigo, e.id]),
        );
        const ids = new Map<string, string>();
        const datosEstudiante = (e: EstudianteImportado) => {
          const cohorte = periodoPorCodigo.get(e.cohorte)!;
          return {
            nombres: e.nombres,
            apellidos: e.apellidos,
            sexo: e.sexo,
            edadIngreso: e.edadIngreso,
            estrato: e.estrato,
            municipioOrigen: e.municipioOrigen,
            departamentoOrigen: e.departamentoOrigen,
            trabaja: e.trabaja,
            horasTrabajoSemana: e.horasTrabajoSemana,
            programaId: programaPorNombre.get(e.programa)!.id,
            periodoIngresoId: cohorte.id,
            cohorte: e.cohorte,
            cohorteAnio: cohorte.anio,
            semestreActual: e.semestres[e.semestres.length - 1].semestre,
            estado: e.estado,
            consentimientoDatos: e.consentimiento,
            fechaConsentimiento: e.consentimiento ? new Date() : null,
          };
        };

        // 1) Estudiantes: nuevos en lote, existentes uno a uno (conservan su id y su hash)
        const nuevos = estudiantes.filter((e) => !existentes.has(e.codigo));
        const nuevosDatos = nuevos.map((e) => {
          const id = randomUUID();
          ids.set(e.codigo, id);
          return { id, codigo: e.codigo, hashAnonimo: hashAnonimoImportado(e.codigo), ...datosEstudiante(e) };
        });
        if (nuevosDatos.length) await tx.estudiante.createMany({ data: nuevosDatos });
        for (const e of estudiantes.filter((x) => existentes.has(x.codigo))) {
          const id = existentes.get(e.codigo)!;
          ids.set(e.codigo, id);
          await tx.estudiante.update({ where: { id }, data: datosEstudiante(e) });
        }
        const todos = [...ids.values()];

        // 2) Trayectoria: el archivo reemplaza matrículas, notas, financiación y retiro de cada estudiante
        await tx.notaSemestre.deleteMany({ where: { estudianteId: { in: todos } } });
        await tx.matricula.deleteMany({ where: { estudianteId: { in: todos } } });
        await tx.financiacion.deleteMany({ where: { estudianteId: { in: todos } } });
        await tx.retiro.deleteMany({ where: { estudianteId: { in: todos } } });

        const matriculas = [];
        const notas = [];
        const financiaciones = [];
        const retiros = [];
        for (const e of estudiantes) {
          const estudianteId = ids.get(e.codigo)!;
          const programa = programaPorNombre.get(e.programa)!;
          let totalMatricula = 0;
          for (const s of e.semestres) {
            const periodoId = periodoPorCodigo.get(s.periodo)!.id;
            const valor = s.valorMatricula ?? programa.valorSemestre;
            totalMatricula += valor;
            matriculas.push({ id: randomUUID(), estudianteId, periodoId, semestre: s.semestre, valorMatricula: valor });
            notas.push({
              id: randomUUID(),
              estudianteId,
              periodoId,
              semestre: s.semestre,
              promedio: s.promedio,
              materiasInscritas: s.materiasInscritas,
              materiasPerdidas: s.materiasPerdidas,
              asistenciaPct: s.asistenciaPct,
            });
          }
          const tipo = e.financiacion.tipo;
          const esCredito = tipo === "ICETEX" || tipo === "CREDITO_UCC";
          const montoTotal = Math.round((totalMatricula * e.financiacion.porcentaje) / 100);
          financiaciones.push({
            id: randomUUID(),
            estudianteId,
            tipo,
            porcentajeCubierto: Math.round(e.financiacion.porcentaje),
            montoTotal,
            saldoPendiente: esCredito ? (e.financiacion.saldoDeuda ?? montoTotal) : 0,
            tasaEA: esCredito ? tasa[tipo] : 0,
            plazoMeses: esCredito ? plazo : 0,
          });
          if (e.estado === "DESERTOR") {
            const ultimo = e.semestres[e.semestres.length - 1];
            const periodo = periodoPorCodigo.get(ultimo.periodo)!;
            retiros.push({
              id: randomUUID(),
              estudianteId,
              periodoId: periodo.id,
              semestreRetiro: ultimo.semestre,
              fechaRetiro: periodo.fechaFin,
              causaId: causaPorNombre.get(e.causaRetiro!)!,
              observacion: `Importado desde ${archivo}`,
            });
          }
        }
        for (let i = 0; i < matriculas.length; i += 1000) await tx.matricula.createMany({ data: matriculas.slice(i, i + 1000) });
        for (let i = 0; i < notas.length; i += 1000) await tx.notaSemestre.createMany({ data: notas.slice(i, i + 1000) });
        await tx.financiacion.createMany({ data: financiaciones });
        if (retiros.length) await tx.retiro.createMany({ data: retiros });

        const registro = await tx.importacion.create({
          data: {
            archivo,
            filas: analisis.resumen.filas,
            estudiantesNuevos: nuevos.length,
            estudiantesActualizados: estudiantes.length - nuevos.length,
            semestres: analisis.resumen.semestres,
            usuarioId: usuario.usuarioId,
          },
        });
        return { importacionId: registro.id, estudiantesNuevos: nuevos.length, estudiantesActualizados: estudiantes.length - nuevos.length };
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    await new ServicioAuditoria().registrar({
      usuarioId: usuario.usuarioId,
      rol: usuario.rol,
      accion: "IMPORTACION",
      recurso: `importacion:${resultado.importacionId}`,
      detalle: `${archivo} · ${analisis.resumen.filas} filas · ${resultado.estudiantesNuevos} nuevos · ${resultado.estudiantesActualizados} actualizados`,
    });

    // Los puntajes de riesgo dependen de las notas: se recalculan para que la alerta temprana quede al día
    let riesgo: ResultadoImportacion["riesgo"] = null;
    try {
      const r = await new ServicioRiesgo().recalcularPuntajes();
      riesgo = { estudiantes: r.estudiantes, alto: r.alto, alertasNuevas: r.alertasNuevas };
    } catch (error) {
      console.warn("[IMPORTACION] No se pudieron recalcular los puntajes de riesgo:", error);
    }

    return {
      ...resultado,
      filas: analisis.resumen.filas,
      semestres: analisis.resumen.semestres,
      desertores: analisis.resumen.desertores,
      riesgo,
    };
  }

  async historial() {
    const filas = await prisma.importacion.findMany({
      orderBy: { creadaEn: "desc" },
      take: 20,
      include: { usuario: { select: { nombre: true } } },
    });
    return filas.map((f) => ({
      id: f.id,
      archivo: f.archivo,
      filas: f.filas,
      estudiantesNuevos: f.estudiantesNuevos,
      estudiantesActualizados: f.estudiantesActualizados,
      semestres: f.semestres,
      usuario: f.usuario.nombre,
      creadaEn: f.creadaEn.toISOString(),
    }));
  }

  async plantilla(): Promise<string> {
    return ImportadorCSV.plantilla((await this.catalogos()).nombres);
  }

  static columnas() {
    return COLUMNAS;
  }
}
