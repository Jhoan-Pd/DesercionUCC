"use client";

import {
  Bar,
  Cell,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { azulSecuencial, COLOR, ETIQUETA_CATEGORIA } from "@/lib/colores";
import { textoLeyenda } from "./leyenda";
import { formatoPct } from "@/lib/utils";
import type { ResumenDashboard } from "@/services/dashboard/ServicioDashboard";
import { TarjetaGrafica } from "./TarjetaGrafica";

const EJE = { fontSize: 12 } as const;
const MARGEN = { top: 8, right: 12, bottom: 4, left: 0 } as const;

/** Tooltip genérico: recibe una función que dibuja las líneas del cuerpo */
function Burbuja({ titulo, lineas }: { titulo: string; lineas: { etiqueta: string; valor: string; color?: string }[] }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{titulo}</p>
      {lineas.map((l) => (
        <p key={l.etiqueta} className="flex items-center gap-2 text-muted-foreground">
          {l.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} aria-hidden />}
          <span>{l.etiqueta}:</span>
          <span className="font-semibold text-foreground">{l.valor}</span>
        </p>
      ))}
    </div>
  );
}

type TP = TooltipProps<number, string>;

// ---------------------------------------------------------------------
// 1. Deserción por cohorte vs referencia nacional
// ---------------------------------------------------------------------
export function GraficaCohorte({ datos }: { datos: ResumenDashboard["porCohorte"] }) {
  return (
    <TarjetaGrafica
      titulo="Deserción acumulada por cohorte"
      descripcion="% de estudiantes de cada cohorte que ya desertó, frente al promedio nacional (SPADIES) con la misma antigüedad."
      nota="Las cohortes recientes aún no completan su trayectoria: por eso se compara con la referencia nacional a igual número de semestres."
      vacio={datos.length === 0}
      tabla={{
        columnas: ["Cohorte", "Estudiantes", "Desertores", "Tasa UCC", "Semestres observados", "Referencia nacional"],
        filas: datos.map((d) => [d.cohorte, d.total, d.desertores, formatoPct(d.tasa), d.semestresObservados, d.referenciaNacional === null ? "—" : formatoPct(d.referenciaNacional)]),
      }}
    >
      <div className="h-80" role="img" aria-label="Gráfica de barras de deserción acumulada por cohorte con línea de referencia nacional">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={datos} margin={MARGEN}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="cohorte" tick={EJE} interval={0} angle={-35} textAnchor="end" height={52} />
            <YAxis tick={EJE} unit="%" width={44} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ResumenDashboard["porCohorte"][number];
                return (
                  <Burbuja
                    titulo={`Cohorte ${d.cohorte}`}
                    lineas={[
                      { etiqueta: "Deserción UCC", valor: formatoPct(d.tasa), color: COLOR.ucc },
                      { etiqueta: "Estudiantes", valor: `${d.desertores} de ${d.total}` },
                      { etiqueta: `Nacional (${d.semestresObservados} sem.)`, valor: d.referenciaNacional === null ? "—" : formatoPct(d.referenciaNacional), color: COLOR.referencia },
                    ]}
                  />
                );
              }}
            />
            <Legend formatter={textoLeyenda} verticalAlign="top" height={28} iconType="plainline" />
            <Bar dataKey="tasa" name="Deserción UCC" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line dataKey="referenciaNacional" name="Referencia nacional" stroke={COLOR.referencia} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, strokeWidth: 2 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

// ---------------------------------------------------------------------
// 2. Por programa
// ---------------------------------------------------------------------
export function GraficaPrograma({ datos }: { datos: ResumenDashboard["porPrograma"] }) {
  return (
    <TarjetaGrafica
      titulo="Deserción por programa"
      descripcion="% de estudiantes que ingresaron y desertaron, ordenado de mayor a menor."
      vacio={datos.length === 0}
      tabla={{
        columnas: ["Programa", "Estudiantes", "Desertores", "Tasa"],
        filas: datos.map((d) => [d.programa, d.total, d.desertores, formatoPct(d.tasa)]),
      }}
    >
      <div style={{ height: Math.max(240, datos.length * 38 + 30) }} role="img" aria-label="Gráfica de barras horizontales de deserción por programa">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ ...MARGEN, left: 8, right: 36 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tick={EJE} unit="%" />
            <YAxis type="category" dataKey="programa" tick={EJE} width={150} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ResumenDashboard["porPrograma"][number];
                return <Burbuja titulo={d.programa} lineas={[{ etiqueta: "Deserción", valor: formatoPct(d.tasa), color: COLOR.ucc }, { etiqueta: "Estudiantes", valor: `${d.desertores} de ${d.total}` }]} />;
              }}
            />
            <Bar dataKey="tasa" name="Deserción" fill={COLOR.ucc} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", formatter: (v: number) => `${v}%`, fontSize: 11, fill: COLOR.tinta }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

// ---------------------------------------------------------------------
// 3. Por semestre cursado
// ---------------------------------------------------------------------
export function GraficaSemestre({ datos }: { datos: ResumenDashboard["porSemestre"] }) {
  return (
    <TarjetaGrafica
      titulo="¿En qué semestre se van?"
      descripcion="De los estudiantes matriculados en cada semestre, % que se retiró en él."
      nota="Los primeros semestres concentran el mayor riesgo: ahí deben enfocarse las intervenciones."
      vacio={datos.length === 0}
      tabla={{
        columnas: ["Semestre", "Matriculados", "Desertores", "Tasa"],
        filas: datos.map((d) => [d.semestre, d.matriculados, d.desertores, formatoPct(d.tasa)]),
      }}
    >
      <div className="h-72" role="img" aria-label="Gráfica de barras de la tasa de deserción por semestre cursado">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={MARGEN}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="semestre" tick={EJE} label={{ value: "Semestre cursado", position: "insideBottom", offset: -2, fontSize: 12 }} height={40} />
            <YAxis tick={EJE} unit="%" width={44} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ResumenDashboard["porSemestre"][number];
                return <Burbuja titulo={`Semestre ${d.semestre}`} lineas={[{ etiqueta: "Tasa", valor: formatoPct(d.tasa, 2), color: COLOR.ucc }, { etiqueta: "Retiros", valor: `${d.desertores} de ${d.matriculados}` }]} />;
              }}
            />
            <Bar dataKey="tasa" name="Tasa de deserción" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

// ---------------------------------------------------------------------
// 4. Por periodo
// ---------------------------------------------------------------------
export function GraficaPeriodo({ datos, referenciaAnual }: { datos: ResumenDashboard["porPeriodo"]; referenciaAnual: number }) {
  // La referencia nacional es ANUAL; se convierte a su equivalente semestral para comparar en la misma escala
  const referenciaSemestral = Math.round((1 - Math.sqrt(1 - referenciaAnual / 100)) * 10000) / 100;
  return (
    <TarjetaGrafica
      titulo="Evolución por periodo"
      descripcion="Tasa intersemestral: retiros del periodo / matriculados en el periodo."
      nota={`Línea punteada: equivalente semestral (${formatoPct(referenciaSemestral, 2)}) de la deserción anual universitaria nacional (${formatoPct(referenciaAnual, 2)}). Los primeros periodos solo incluyen cohortes desde 2018 (casi todos en primeros semestres), por eso su tasa es más alta.`}
      vacio={datos.length === 0}
      tabla={{
        columnas: ["Periodo", "Matriculados", "Retiros", "Tasa intersemestral"],
        filas: datos.map((d) => [d.periodo, d.matriculados, d.desertores, formatoPct(d.tasa, 2)]),
      }}
    >
      <div className="h-72" role="img" aria-label="Gráfica de líneas de la tasa de deserción por periodo académico">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={MARGEN}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="periodo" tick={EJE} interval={0} angle={-35} textAnchor="end" height={52} />
            <YAxis tick={EJE} unit="%" width={44} />
            <Tooltip
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ResumenDashboard["porPeriodo"][number];
                return <Burbuja titulo={`Periodo ${d.periodo}`} lineas={[{ etiqueta: "Tasa", valor: formatoPct(d.tasa, 2), color: COLOR.ucc }, { etiqueta: "Retiros", valor: `${d.desertores} de ${d.matriculados}` }]} />;
              }}
            />
            <ReferenceLine y={referenciaSemestral} stroke={COLOR.referencia} strokeDasharray="5 4" strokeWidth={2} />
            <Line dataKey="tasa" name="Tasa intersemestral" stroke={COLOR.ucc} strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

// ---------------------------------------------------------------------
// 5. Curvas de supervivencia
// ---------------------------------------------------------------------
export function GraficaSupervivencia({ datos }: { datos: ResumenDashboard["supervivencia"] }) {
  const cohortes = datos.series.filter((s) => s !== "Todas" && s !== "Nacional");
  return (
    <TarjetaGrafica
      titulo="Curva de supervivencia por cohorte"
      descripcion="% de estudiantes que sigue en la UCC después de cada semestre (estimador Kaplan-Meier). Cohortes en azul: más oscuro = más reciente."
      nota="Kaplan-Meier incorpora a los estudiantes que aún estudian sin sesgar la curva; las cohortes recientes solo llegan hasta donde hay datos."
      vacio={datos.puntos.length === 0 || cohortes.length === 0}
      className="lg:col-span-2"
      tabla={{
        columnas: ["Semestre", ...datos.series],
        filas: datos.puntos.map((p) => [p.semestre, ...datos.series.map((s) => (p[s] === null || p[s] === undefined ? "—" : formatoPct(p[s] as number)))]),
      }}
    >
      <div className="h-96" role="img" aria-label="Gráfica de líneas con la curva de supervivencia de cada cohorte, el total y la referencia nacional">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos.puntos} margin={MARGEN}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="semestre" tick={EJE} label={{ value: "Semestres cursados", position: "insideBottom", offset: -2, fontSize: 12 }} height={40} />
            <YAxis tick={EJE} unit="%" domain={[(min: number) => Math.max(0, Math.floor((min - 5) / 10) * 10), 100]} width={44} allowDataOverflow={false} />
            <Tooltip
              content={({ active, payload, label }: TP) => {
                if (!active || !payload?.length) return null;
                return (
                  <Burbuja
                    titulo={`Después del semestre ${label}`}
                    lineas={payload
                      .filter((p) => typeof p.value === "number")
                      .map((p) => ({ etiqueta: p.name === "Todas" ? "Todas las cohortes" : String(p.name), valor: formatoPct(p.value as number), color: String(p.color) }))}
                  />
                );
              }}
            />
            <Legend formatter={textoLeyenda} verticalAlign="top" height={30} iconType="plainline" />
            {cohortes.map((c, i) => (
              <Line key={c} dataKey={c} name={c} stroke={azulSecuencial(i, cohortes.length)} strokeWidth={1.5} dot={false} connectNulls={false} />
            ))}
            <Line dataKey="Todas" name="Todas" stroke={COLOR.tinta} strokeWidth={3} dot={false} connectNulls={false} />
            <Line dataKey="Nacional" name="Nacional (SPADIES)" stroke={COLOR.referencia} strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

// ---------------------------------------------------------------------
// 6. Causas
// ---------------------------------------------------------------------
export function GraficaCausas({ datos }: { datos: ResumenDashboard["causas"] }) {
  const categorias = datos.porCategoria.map((c) => ({ ...c, nombre: ETIQUETA_CATEGORIA[c.categoria] }));
  return (
    <>
      <TarjetaGrafica
        titulo="Causas principales de retiro"
        descripcion="Las 8 causas más frecuentes, coloreadas por categoría del MEN (SPADIES)."
        vacio={datos.topCausas.length === 0}
        tabla={{
          columnas: ["Causa", "Categoría", "Retiros", "% del total"],
          filas: datos.topCausas.map((c) => [c.causa, ETIQUETA_CATEGORIA[c.categoria], c.total, formatoPct(c.porcentaje)]),
        }}
      >
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {Object.entries(ETIQUETA_CATEGORIA).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR.categoria[k as keyof typeof COLOR.categoria] }} aria-hidden /> {v}
            </span>
          ))}
        </div>
        <div style={{ height: Math.max(260, datos.topCausas.length * 40 + 20) }} role="img" aria-label="Gráfica de barras horizontales con las causas principales de retiro">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos.topCausas} layout="vertical" margin={{ ...MARGEN, left: 8, right: 36 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tick={EJE} />
              <YAxis type="category" dataKey="causa" tick={EJE} width={190} />
              <Tooltip
                cursor={{ fill: "rgba(0,84,159,0.06)" }}
                content={({ active, payload }: TP) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as ResumenDashboard["causas"]["topCausas"][number];
                  return <Burbuja titulo={d.causa} lineas={[{ etiqueta: "Categoría", valor: ETIQUETA_CATEGORIA[d.categoria], color: COLOR.categoria[d.categoria] }, { etiqueta: "Retiros", valor: `${d.total} (${formatoPct(d.porcentaje)})` }]} />;
                }}
              />
              <Bar dataKey="total" name="Retiros" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fontSize: 11, fill: COLOR.tinta }}>
                {datos.topCausas.map((c) => (
                  <Cell key={c.causa} fill={COLOR.categoria[c.categoria]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TarjetaGrafica>

      <TarjetaGrafica
        titulo="Causas por categoría vs. referencia nacional"
        descripcion="Distribución de los retiros en las cuatro categorías de determinantes del MEN."
        nota="La referencia nacional es un valor configurable (Admin → Parámetros); el inicial es ilustrativo hasta cargar la distribución oficial de SPADIES."
        vacio={datos.topCausas.length === 0}
        tabla={{
          columnas: ["Categoría", "Retiros", "% UCC", "% Nacional (ref.)"],
          filas: categorias.map((c) => [c.nombre, c.total, formatoPct(c.porcentaje), formatoPct(c.referenciaNacional)]),
        }}
      >
        <div className="h-80" role="img" aria-label="Gráfica de barras agrupadas: porcentaje de retiros por categoría de causa, UCC frente a referencia nacional">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categorias} margin={MARGEN}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="nombre" tick={EJE} />
              <YAxis tick={EJE} unit="%" width={44} />
              <Tooltip
                cursor={{ fill: "rgba(0,84,159,0.06)" }}
                content={({ active, payload }: TP) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof categorias)[number];
                  return <Burbuja titulo={d.nombre} lineas={[{ etiqueta: "UCC", valor: `${formatoPct(d.porcentaje)} (${d.total} retiros)`, color: COLOR.ucc }, { etiqueta: "Nacional (ref.)", valor: formatoPct(d.referenciaNacional), color: COLOR.referencia }]} />;
                }}
              />
              <Legend formatter={textoLeyenda} verticalAlign="top" height={28} />
              <Bar dataKey="porcentaje" name="UCC" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="referenciaNacional" name="Nacional (ref.)" fill={COLOR.referencia} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TarjetaGrafica>
    </>
  );
}

// ---------------------------------------------------------------------
// 7. Municipio de origen (dimensión regional)
// ---------------------------------------------------------------------
export function GraficaMunicipio({ datos }: { datos: ResumenDashboard["porMunicipio"] }) {
  return (
    <TarjetaGrafica
      titulo="Dimensión regional: municipio de origen"
      descripcion="Municipios con más desertores (mínimo 15 estudiantes). Muestra de dónde se pierde talento para la región."
      vacio={datos.length === 0}
      className="lg:col-span-2"
      tabla={{
        columnas: ["Municipio", "Estudiantes", "Desertores", "Tasa"],
        filas: datos.map((d) => [d.municipio, d.total, d.desertores, formatoPct(d.tasa)]),
      }}
    >
      <div className="h-72" role="img" aria-label="Gráfica de barras de desertores por municipio de origen">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={MARGEN}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="municipio" tick={EJE} interval={0} angle={-25} textAnchor="end" height={56} />
            <YAxis tick={EJE} width={36} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ResumenDashboard["porMunicipio"][number];
                return <Burbuja titulo={d.municipio} lineas={[{ etiqueta: "Desertores", valor: `${d.desertores} de ${d.total}`, color: COLOR.ucc }, { etiqueta: "Tasa", valor: formatoPct(d.tasa) }]} />;
              }}
            />
            <Bar dataKey="desertores" name="Desertores" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}
