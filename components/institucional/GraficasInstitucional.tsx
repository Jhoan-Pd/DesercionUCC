"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { COLOR } from "@/lib/colores";
import { formatoCOP, formatoCOPCompacto, formatoPct } from "@/lib/utils";
import { textoLeyenda } from "@/components/dashboard/leyenda";
import { TarjetaGrafica } from "@/components/dashboard/TarjetaGrafica";
import type { FilaGraduacion, FilaMonto, FilaRegional } from "@/services/institucional/CalculadoraInstitucional";

type TP = TooltipProps<number, string>;
const GRIS = "#94a3b8";

function Burbuja({ titulo, lineas }: { titulo: string; lineas: { etiqueta: string; valor: string; color?: string }[] }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{titulo}</p>
      {lineas.map((l) => (
        <p key={l.etiqueta} className="flex items-center gap-2 text-muted-foreground">
          {l.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} aria-hidden />}
          {l.etiqueta}: <span className="font-semibold text-foreground">{l.valor}</span>
        </p>
      ))}
    </div>
  );
}

export function GraficaMatriculaPrograma({ datos }: { datos: FilaMonto[] }) {
  return (
    <TarjetaGrafica
      titulo="Matrícula no percibida por programa"
      descripcion="Semestres que los desertores no cursaron × valor actual del semestre del programa."
      vacio={datos.length === 0}
      tabla={{ columnas: ["Programa", "Desertores", "Semestres no cursados", "Matrícula no percibida"], filas: datos.map((d) => [d.clave, d.desertores, d.semestresNoCursados, formatoCOP(d.ingresosNoPercibidos)]) }}
    >
      <div style={{ height: Math.max(240, datos.length * 38 + 30) }} role="img" aria-label="Barras horizontales: matrícula no percibida por programa">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 64, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatoCOPCompacto(v)} />
            <YAxis type="category" dataKey="clave" tick={{ fontSize: 12 }} width={150} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as FilaMonto;
                return <Burbuja titulo={d.clave} lineas={[{ etiqueta: "No percibido", valor: formatoCOP(d.ingresosNoPercibidos), color: COLOR.ucc }, { etiqueta: "Desertores", valor: String(d.desertores) }, { etiqueta: "Semestres no cursados", valor: String(d.semestresNoCursados) }]} />;
              }}
            />
            <Bar dataKey="ingresosNoPercibidos" name="Matrícula no percibida" fill={COLOR.ucc} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", formatter: (v: number) => formatoCOPCompacto(v), fontSize: 11, fill: COLOR.tinta }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

export function GraficaMatriculaAnio({ datos }: { datos: FilaMonto[] }) {
  return (
    <TarjetaGrafica
      titulo="Matrícula futura perdida por año de retiro"
      descripcion="Lo que la UCC deja de recibir por los estudiantes que se retiraron cada año."
      vacio={datos.length === 0}
      tabla={{ columnas: ["Año de retiro", "Desertores", "Semestres no cursados", "Matrícula no percibida"], filas: datos.map((d) => [d.clave, d.desertores, d.semestresNoCursados, formatoCOP(d.ingresosNoPercibidos)]) }}
    >
      <div className="h-72" role="img" aria-label="Barras: matrícula no percibida por año de retiro">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="clave" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatoCOPCompacto(v)} width={96} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as FilaMonto;
                return <Burbuja titulo={`Retiros de ${d.clave}`} lineas={[{ etiqueta: "No percibido", valor: formatoCOP(d.ingresosNoPercibidos), color: COLOR.ucc }, { etiqueta: "Desertores", valor: String(d.desertores) }]} />;
              }}
            />
            <Bar dataKey="ingresosNoPercibidos" name="Matrícula no percibida" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

/** Barras apiladas al 100 %: graduados, rezagados y desertores de cada cohorte con plazo vencido */
export function GraficaGraduacion({ datos }: { datos: FilaGraduacion[] }) {
  const filas = datos.map((d) => ({
    ...d,
    pGraduados: (100 * d.graduados) / d.estudiantes,
    pRezagados: (100 * d.rezagados) / d.estudiantes,
    pDesertores: (100 * d.desertores) / d.estudiantes,
  }));
  return (
    <TarjetaGrafica
      titulo="Graduación y deserción por cohorte"
      descripcion="Solo estudiantes cuyo plazo de grado (duración del plan + 2 semestres) ya venció."
      nota="Las cohortes recientes no aparecen porque aún están dentro del plazo de grado."
      vacio={datos.length === 0}
      tabla={{
        columnas: ["Cohorte", "Estudiantes", "Graduados", "Rezagados", "Desertores", "Tasa de graduación"],
        filas: datos.map((d) => [d.cohorte, d.estudiantes, d.graduados, d.rezagados, d.desertores, formatoPct(d.tasaGraduacion)]),
      }}
    >
      <div className="h-72" role="img" aria-label="Barras apiladas: porcentaje de graduados, rezagados y desertores por cohorte">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="cohorte" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof filas)[number];
                return (
                  <Burbuja
                    titulo={`Cohorte ${d.cohorte} (${d.estudiantes} estudiantes)`}
                    lineas={[
                      { etiqueta: "Graduados", valor: `${d.graduados} (${formatoPct(d.pGraduados)})`, color: COLOR.ucc },
                      { etiqueta: "Rezagados", valor: `${d.rezagados} (${formatoPct(d.pRezagados)})`, color: GRIS },
                      { etiqueta: "Desertores", valor: `${d.desertores} (${formatoPct(d.pDesertores)})`, color: COLOR.referencia },
                    ]}
                  />
                );
              }}
            />
            <Legend verticalAlign="top" height={28} formatter={textoLeyenda} />
            <Bar dataKey="pGraduados" stackId="c" name="Graduados" fill={COLOR.ucc} maxBarSize={48} stroke="#fff" strokeWidth={1} />
            <Bar dataKey="pRezagados" stackId="c" name="Rezagados" fill={GRIS} maxBarSize={48} stroke="#fff" strokeWidth={1} />
            <Bar dataKey="pDesertores" stackId="c" name="Desertores" fill={COLOR.referencia} maxBarSize={48} radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}

export function GraficaRegional({ datos, horizonte }: { datos: FilaRegional[]; horizonte: number }) {
  const top = datos.slice(0, 10);
  return (
    <TarjetaGrafica
      titulo="Dimensión regional: ingresos que dejan de generar los municipios"
      descripcion={`Valor presente a ${horizonte} años de la diferencia de ingresos entre graduarse y quedarse como bachiller, sumado por municipio de origen.`}
      nota="Calculado por estudiante con la misma CalculadoraImpacto de la calculadora individual y los salarios de referencia del OLE (editables en Parámetros)."
      vacio={top.length === 0}
      className="lg:col-span-2"
      tabla={{ columnas: ["Municipio", "Departamento", "Desertores", "Ingresos de por vida no generados (VP)"], filas: datos.map((d) => [d.municipio, d.departamento, d.desertores, formatoCOP(d.perdidaIngresoVida)]) }}
    >
      <div className="h-80" role="img" aria-label="Barras: ingresos de por vida no generados por municipio de origen">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="municipio" tick={{ fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={56} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatoCOPCompacto(v)} width={104} />
            <Tooltip
              cursor={{ fill: "rgba(0,84,159,0.06)" }}
              content={({ active, payload }: TP) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as FilaRegional;
                return <Burbuja titulo={`${d.municipio} (${d.departamento})`} lineas={[{ etiqueta: "Ingresos no generados", valor: formatoCOP(d.perdidaIngresoVida), color: COLOR.ucc }, { etiqueta: "Desertores", valor: String(d.desertores) }]} />;
              }}
            />
            <Bar dataKey="perdidaIngresoVida" name="Ingresos no generados" fill={COLOR.ucc} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TarjetaGrafica>
  );
}
