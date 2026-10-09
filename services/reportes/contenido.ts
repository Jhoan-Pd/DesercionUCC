/**
 * Contenido de cada reporte: funciones PURAS que reciben lo que ya calculan los servicios
 * (dashboard, riesgo, intervenciones, impacto institucional) y arman las secciones del reporte.
 * No consultan la BD, así que se prueban con datos de ejemplo.
 */
import { ETIQUETA_CATEGORIA } from "@/lib/colores";
import { TIPO_INTERVENCION } from "@/lib/etiquetas";
import { formatoCOP, formatoNumero, formatoPct } from "@/lib/utils";
import type { ResumenDashboard } from "@/services/dashboard/ServicioDashboard";
import { CalculadoraInstitucional } from "@/services/institucional/CalculadoraInstitucional";
import type { ImpactoInstitucional } from "@/services/institucional/ServicioImpactoInstitucional";
import type { EfectividadIntervenciones } from "@/services/intervenciones/ServicioIntervenciones";
import { AVISO_PRIVACIDAD, TITULOS_REPORTE, type DatosReporte, type TipoReporte } from "./tipos";

export interface ContextoReporte {
  generadoEn: Date;
  generadoPorRol: string;
  filtros: string[];
}

function base(tipo: TipoReporte, ctx: ContextoReporte): Omit<DatosReporte, "secciones"> {
  return {
    tipo,
    titulo: TITULOS_REPORTE[tipo].titulo,
    subtitulo: TITULOS_REPORTE[tipo].descripcion,
    generadoEn: ctx.generadoEn,
    generadoPorRol: ctx.generadoPorRol,
    filtros: ctx.filtros,
    avisoPrivacidad: AVISO_PRIVACIDAD,
  };
}

const signo = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("es-CO", { maximumFractionDigits: 1 })} pp`;

// ---------------------------------------------------------------------
// 1. Institucional (dashboard)
// ---------------------------------------------------------------------
export function contenidoInstitucional(r: ResumenDashboard, ctx: ContextoReporte): DatosReporte {
  const k = r.kpis;
  return {
    ...base("institucional", ctx),
    secciones: [
      {
        titulo: "Indicadores clave",
        descripcion: `Periodo actual ${r.periodoActual ?? "—"}. Comparación con la referencia nacional de SPADIES (Ministerio de Educación).`,
        indicadores: [
          { etiqueta: "Estudiantes analizados", valor: formatoNumero(k.total), detalle: `${formatoNumero(k.activos)} activos · ${formatoNumero(k.graduados)} graduados` },
          { etiqueta: "Desertores", valor: formatoNumero(k.desertores), detalle: `${formatoPct(k.tasaAcumulada)} de quienes ingresaron` },
          { etiqueta: "Deserción anual (últimos 2 periodos)", valor: k.tasaAnual === null ? "—" : formatoPct(k.tasaAnual), detalle: `Nacional universitaria: ${formatoPct(k.referenciaAnualNacional, 2)}` },
          { etiqueta: "Brecha frente a la referencia nacional", valor: k.brechaAnualVsNacional === null ? "—" : signo(k.brechaAnualVsNacional), detalle: "pp = puntos porcentuales" },
          { etiqueta: "Último periodo cerrado", valor: k.ultimoPeriodo ?? "—", detalle: k.tasaUltimoPeriodo === null ? undefined : `Tasa intersemestral ${formatoPct(k.tasaUltimoPeriodo, 2)}` },
          { etiqueta: "Aplazados", valor: formatoNumero(k.aplazados) },
        ],
      },
      {
        titulo: "Deserción por programa",
        hoja: "Por programa",
        barras: { titulo: "Deserción acumulada por programa", formato: "pct", datos: r.porPrograma.map((p) => ({ etiqueta: p.programa, valor: p.tasa })) },
        tabla: {
          columnas: [{ titulo: "Programa", formato: "texto" }, { titulo: "Estudiantes", formato: "entero" }, { titulo: "Desertores", formato: "entero" }, { titulo: "Tasa de deserción", formato: "pct" }],
          filas: r.porPrograma.map((p) => [p.programa, p.total, p.desertores, p.tasa]),
        },
      },
      {
        titulo: "Deserción por cohorte",
        hoja: "Por cohorte",
        descripcion: "Las cohortes recientes aún no completan su trayectoria: se comparan con la referencia nacional a igual número de semestres.",
        tabla: {
          columnas: [
            { titulo: "Cohorte", formato: "texto" },
            { titulo: "Estudiantes", formato: "entero" },
            { titulo: "Desertores", formato: "entero" },
            { titulo: "Tasa UCC", formato: "pct" },
            { titulo: "Semestres observados", formato: "entero" },
            { titulo: "Referencia nacional", formato: "pct" },
          ],
          filas: r.porCohorte.map((c) => [c.cohorte, c.total, c.desertores, c.tasa, c.semestresObservados, c.referenciaNacional]),
        },
      },
      {
        titulo: "¿En qué semestre se van?",
        hoja: "Por semestre",
        descripcion: "De los matriculados en cada semestre, porcentaje que se retiró en él.",
        tabla: {
          columnas: [{ titulo: "Semestre", formato: "entero" }, { titulo: "Matriculados", formato: "entero" }, { titulo: "Desertores", formato: "entero" }, { titulo: "Tasa", formato: "pct" }],
          filas: r.porSemestre.map((s) => [s.semestre, s.matriculados, s.desertores, s.tasa]),
        },
      },
      {
        titulo: "Evolución por periodo",
        hoja: "Por periodo",
        tabla: {
          columnas: [{ titulo: "Periodo", formato: "texto" }, { titulo: "Matriculados", formato: "entero" }, { titulo: "Retiros", formato: "entero" }, { titulo: "Tasa intersemestral", formato: "pct" }],
          filas: r.porPeriodo.map((p) => [p.periodo, p.matriculados, p.desertores, p.tasa]),
        },
      },
      {
        titulo: "Curva de supervivencia (Kaplan-Meier)",
        hoja: "Supervivencia",
        descripcion: "Porcentaje de estudiantes que sigue en la UCC después de cada semestre, frente a la curva nacional.",
        tabla: {
          columnas: [{ titulo: "Semestre", formato: "entero" }, { titulo: "Todas las cohortes", formato: "pct" }, { titulo: "Nacional (SPADIES)", formato: "pct" }],
          filas: r.supervivencia.puntos.map((p) => [p.semestre, (p["Todas"] as number | null) ?? null, (p["Nacional"] as number | null) ?? null]),
        },
      },
      {
        titulo: "Causas de retiro (clasificación MEN)",
        hoja: "Causas",
        barras: { titulo: "Retiros por categoría de causa (%)", formato: "pct", datos: r.causas.porCategoria.map((c) => ({ etiqueta: ETIQUETA_CATEGORIA[c.categoria], valor: c.porcentaje })) },
        tabla: {
          columnas: [{ titulo: "Causa", formato: "texto" }, { titulo: "Categoría", formato: "texto" }, { titulo: "Retiros", formato: "entero" }, { titulo: "% del total", formato: "pct" }],
          filas: r.causas.topCausas.map((c) => [c.causa, ETIQUETA_CATEGORIA[c.categoria], c.total, c.porcentaje]),
        },
        notas: ["La distribución nacional por categoría es configurable en Admin → Parámetros; el valor inicial es ilustrativo hasta cargar la cifra oficial de SPADIES."],
      },
      {
        titulo: "Dimensión regional: municipio de origen",
        hoja: "Municipios",
        tabla: {
          columnas: [{ titulo: "Municipio", formato: "texto" }, { titulo: "Estudiantes", formato: "entero" }, { titulo: "Desertores", formato: "entero" }, { titulo: "Tasa", formato: "pct" }],
          filas: r.porMunicipio.map((m) => [m.municipio, m.total, m.desertores, m.tasa]),
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 2. Lista priorizada de riesgo (anonimizada)
// ---------------------------------------------------------------------

/**
 * Fila de riesgo SIN datos personales: el servicio nunca selecciona nombres ni códigos
 * institucionales; solo el identificador anónimo.
 */
export interface FilaRiesgoAnonima {
  hashAnonimo: string;
  programa: string;
  semestre: number;
  puntaje: number;
  nivel: "BAJO" | "MEDIO" | "ALTO";
  factores: string[];
  alertasAbiertas: number;
  intervencionesEnCurso: number;
}

export function contenidoRiesgo(
  filas: FilaRiesgoAnonima[],
  resumen: { ALTO: number; MEDIO: number; BAJO: number; periodo: string | null; modelo: string },
  ctx: ContextoReporte,
): DatosReporte {
  const sinAtencion = filas.filter((f) => f.nivel === "ALTO" && f.intervencionesEnCurso === 0).length;
  return {
    ...base("riesgo", ctx),
    secciones: [
      {
        titulo: "Resumen",
        descripcion: `Periodo ${resumen.periodo ?? "—"} · Modelo ${resumen.modelo}. El puntaje (0-100) prioriza el acompañamiento; no es un diagnóstico.`,
        indicadores: [
          { etiqueta: "Riesgo alto", valor: formatoNumero(resumen.ALTO), detalle: `${formatoNumero(sinAtencion)} sin intervención en curso` },
          { etiqueta: "Riesgo medio", valor: formatoNumero(resumen.MEDIO) },
          { etiqueta: "Riesgo bajo", valor: formatoNumero(resumen.BAJO), detalle: "No se listan en el detalle" },
        ],
      },
      {
        titulo: "Estudiantes con riesgo alto y medio",
        hoja: "Lista priorizada",
        descripcion: "Ordenados de mayor a menor puntaje. El código anónimo permite a Bienestar ubicar la ficha en el sistema sin exponer la identidad en el documento.",
        tabla: {
          columnas: [
            { titulo: "Código anónimo", formato: "texto", ancho: 18 },
            { titulo: "Programa", formato: "texto", ancho: 28 },
            { titulo: "Semestre", formato: "entero" },
            { titulo: "Puntaje", formato: "entero" },
            { titulo: "Nivel", formato: "texto" },
            { titulo: "Factores que más pesan", formato: "texto", ancho: 60 },
            { titulo: "Alertas abiertas", formato: "entero" },
            { titulo: "Intervenciones en curso", formato: "entero" },
          ],
          filas: filas.map((f) => [f.hashAnonimo, f.programa, f.semestre, f.puntaje, f.nivel, f.factores.join("; ") || "—", f.alertasAbiertas, f.intervencionesEnCurso]),
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 3. Efectividad de intervenciones
// ---------------------------------------------------------------------
export function contenidoIntervenciones(e: EfectividadIntervenciones, ctx: ContextoReporte): DatosReporte {
  const g = e.general;
  const ic = g.ic95 ? `IC 95 %: ${signo(g.ic95[0])} a ${signo(g.ic95[1])}` : "Sin intervalo";
  return {
    ...base("intervenciones", ctx),
    secciones: [
      {
        titulo: "Resultado general",
        descripcion: `Estudiantes-semestre con riesgo evaluados por el modelo ${e.modeloVersion}${e.desde ? ` desde ${e.desde}` : ""}. Se compara la permanencia de intervenidos y no intervenidos dentro de la misma franja de riesgo (efecto ajustado).`,
        indicadores: [
          { etiqueta: "Permanencia de intervenidos", valor: formatoPct(g.tratados.tasa), detalle: `${formatoNumero(g.tratados.permanecieron)} de ${formatoNumero(g.tratados.n)}` },
          { etiqueta: "Permanencia de no intervenidos", valor: formatoPct(g.controles.tasa), detalle: `${formatoNumero(g.controles.permanecieron)} de ${formatoNumero(g.controles.n)}` },
          { etiqueta: "Efecto ajustado por riesgo", valor: g.efectoAjustado === null ? "—" : signo(g.efectoAjustado), detalle: `${ic}${g.significativo ? " · significativo" : " · no significativo"}` },
          { etiqueta: "Diferencia sin ajustar", valor: signo(g.diferenciaIngenua), detalle: "Sesgada: Bienestar interviene a quienes tienen más riesgo" },
          { etiqueta: "Observaciones analizadas", valor: formatoNumero(e.observaciones) },
        ],
        notas: e.interpretacion,
      },
      {
        titulo: "Permanencia por franja de riesgo",
        hoja: "Por franja",
        tabla: {
          columnas: [
            { titulo: "Franja de riesgo", formato: "texto" },
            { titulo: "Intervenidos", formato: "entero" },
            { titulo: "Permanencia intervenidos", formato: "pct" },
            { titulo: "No intervenidos", formato: "entero" },
            { titulo: "Permanencia no intervenidos", formato: "pct" },
            { titulo: "Diferencia (pp)", formato: "decimal" },
          ],
          filas: g.estratos.map((s) => [s.franja, s.tratados.n, s.tratados.n ? s.tratados.tasa : null, s.controles.n, s.controles.n ? s.controles.tasa : null, s.diferencia]),
        },
      },
      {
        titulo: "Efecto por tipo de intervención",
        hoja: "Por tipo",
        barras: {
          titulo: "Efecto ajustado sobre la permanencia (puntos porcentuales)",
          formato: "entero",
          datos: e.porTipo.filter((t) => t.efectoAjustado !== null).map((t) => ({ etiqueta: TIPO_INTERVENCION[t.tipo] ?? t.tipo, valor: t.efectoAjustado as number })),
        },
        tabla: {
          columnas: [
            { titulo: "Tipo", formato: "texto" },
            { titulo: "Intervenidos", formato: "entero" },
            { titulo: "Permanencia", formato: "pct" },
            { titulo: "Efecto ajustado (pp)", formato: "decimal" },
            { titulo: "IC 95 % inferior", formato: "decimal" },
            { titulo: "IC 95 % superior", formato: "decimal" },
            { titulo: "Significativo", formato: "texto" },
          ],
          filas: e.porTipo.map((t) => [TIPO_INTERVENCION[t.tipo] ?? t.tipo, t.tratados.n, t.tratados.tasa, t.efectoAjustado, t.ic95?.[0] ?? null, t.ic95?.[1] ?? null, t.significativo ? "Sí" : "No"]),
        },
      },
      {
        titulo: "Cobertura por periodo",
        hoja: "Cobertura",
        descripcion: "Porcentaje de estudiantes en riesgo que recibió al menos una intervención.",
        tabla: {
          columnas: [{ titulo: "Periodo", formato: "texto" }, { titulo: "En riesgo", formato: "entero" }, { titulo: "Intervenidos", formato: "entero" }, { titulo: "Cobertura", formato: "pct" }],
          filas: e.cobertura.map((c) => [c.periodo, c.enRiesgo, c.intervenidos, c.cobertura]),
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------
// 4. Impacto institucional y regional
// ---------------------------------------------------------------------
export function contenidoImpactoInstitucional(i: ImpactoInstitucional, ctx: ContextoReporte): DatosReporte {
  const lb = i.lineaBase;
  const escenarios = [10, 20, 30].map((x) => CalculadoraInstitucional.proyectar(lb, x));
  return {
    ...base("impacto-institucional", ctx),
    secciones: [
      {
        titulo: "Indicadores clave",
        descripcion: `Periodo actual ${i.periodoActual ?? "—"}. Línea base anual: ${i.periodosBase.join(" y ") || "—"}.`,
        indicadores: [
          { etiqueta: "Matrícula no percibida (histórico)", valor: formatoCOP(i.ingresosNoPercibidos), detalle: `${formatoNumero(i.semestresNoCursados)} semestres que no se cursaron` },
          { etiqueta: "Desertores analizados", valor: formatoNumero(i.desertores), detalle: `${formatoNumero(i.semestresCursadosSinTitulo)} semestres cursados sin título` },
          { etiqueta: `Pérdida de ingresos regional (${i.horizonteAnios} años, VP)`, valor: formatoCOP(i.perdidaRegionalTotal), detalle: "Lo que dejan de ganar los desertores frente a graduarse" },
          { etiqueta: "Tasa de graduación (cohortes con plazo vencido)", valor: formatoPct(lb.tasaGraduacion), detalle: `Rezago ${formatoPct(lb.tasaRezago)}` },
          { etiqueta: "Deserción anual", valor: formatoPct(lb.tasaDesercionAnual), detalle: `${formatoNumero(lb.desertoresAnuales)} desertores en el último año` },
          { etiqueta: "Matrícula que se pierde por año", valor: formatoCOP(lb.ingresosPerdidosAnuales) },
        ],
      },
      {
        titulo: "Matrícula no percibida por programa",
        hoja: "Por programa",
        barras: { titulo: "Ingresos por matrícula dejados de percibir", formato: "cop", datos: i.porPrograma.map((p) => ({ etiqueta: p.clave, valor: p.ingresosNoPercibidos })) },
        tabla: {
          columnas: [{ titulo: "Programa", formato: "texto" }, { titulo: "Desertores", formato: "entero" }, { titulo: "Semestres no cursados", formato: "entero" }, { titulo: "Matrícula no percibida", formato: "cop" }],
          filas: i.porPrograma.map((p) => [p.clave, p.desertores, p.semestresNoCursados, p.ingresosNoPercibidos]),
        },
      },
      {
        titulo: "Matrícula no percibida por año de retiro",
        hoja: "Por año",
        tabla: {
          columnas: [{ titulo: "Año", formato: "texto" }, { titulo: "Desertores", formato: "entero" }, { titulo: "Semestres no cursados", formato: "entero" }, { titulo: "Matrícula no percibida", formato: "cop" }],
          filas: i.porAnioRetiro.map((p) => [p.clave, p.desertores, p.semestresNoCursados, p.ingresosNoPercibidos]),
        },
      },
      {
        titulo: "Graduación y permanencia por cohorte",
        hoja: "Graduación",
        tabla: {
          columnas: [
            { titulo: "Cohorte", formato: "texto" },
            { titulo: "Estudiantes", formato: "entero" },
            { titulo: "Graduados", formato: "entero" },
            { titulo: "Desertores", formato: "entero" },
            { titulo: "Rezagados", formato: "entero" },
            { titulo: "Tasa de graduación", formato: "pct" },
            { titulo: "Tasa de deserción", formato: "pct" },
          ],
          filas: i.graduacion.map((g) => [String(g.cohorte), g.estudiantes, g.graduados, g.desertores, g.rezagados, g.tasaGraduacion, g.tasaDesercion]),
        },
      },
      {
        titulo: "Dimensión social y regional",
        hoja: "Regional",
        descripcion: "Ingresos de por vida (valor presente) que los desertores dejan de percibir frente a graduarse, por municipio de origen.",
        tabla: {
          columnas: [{ titulo: "Municipio", formato: "texto" }, { titulo: "Departamento", formato: "texto" }, { titulo: "Desertores", formato: "entero" }, { titulo: "Pérdida de ingresos (VP)", formato: "cop" }],
          filas: i.regional.map((r) => [r.municipio, r.departamento, r.desertores, r.perdidaIngresoVida]),
        },
      },
      {
        titulo: "Proyección: ¿qué pasa si la deserción baja?",
        hoja: "Proyección",
        tabla: {
          columnas: [
            { titulo: "Reducción de la deserción", formato: "pct" },
            { titulo: "Estudiantes retenidos por año", formato: "entero" },
            { titulo: "Matrícula recuperada por año", formato: "cop" },
            { titulo: "Matrícula recuperada en 5 años", formato: "cop" },
            { titulo: "Pérdida regional evitada por año", formato: "cop" },
            { titulo: "Nueva deserción anual", formato: "pct" },
            { titulo: "Nueva tasa de graduación", formato: "pct" },
          ],
          filas: escenarios.map((p) => [p.reduccionPct, p.estudiantesRetenidosAnio, p.ingresosRecuperadosAnio, p.ingresosRecuperados5Anios, p.perdidaRegionalEvitadaAnio, p.tasaDesercionAnualNueva, p.tasaGraduacionNueva]),
        },
        notas: ["Escenarios de reducción del 10, 20 y 30 % sobre la línea base anual. En la aplicación se puede simular cualquier porcentaje."],
      },
    ],
  };
}
