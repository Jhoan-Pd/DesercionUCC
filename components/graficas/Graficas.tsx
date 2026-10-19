"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLOR } from "@/lib/colores";

const fmt = (v: number) => v.toLocaleString("es-CO");

interface Punto {
  etiqueta: string;
  valor: number;
  /** Resalta la barra (p. ej. la sede Pasto entre todas las sedes) */
  destacado?: boolean;
}

function Ayuda({ active, payload, unidad }: { active?: boolean; payload?: { payload: Punto }[]; unidad: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{p.etiqueta}</p>
      <p className="tabular-nums text-muted-foreground">
        {fmt(p.valor)} {unidad}
      </p>
    </div>
  );
}

/** Columnas verticales de una sola serie (p. ej. matrícula por año) */
export function GraficaColumnas({ datos, unidad, alto = 260, titulo }: { datos: Punto[]; unidad: string; alto?: number; titulo: string }) {
  return (
    <figure aria-label={titulo}>
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickFormatter={fmt} tickLine={false} axisLine={false} fontSize={12} width={48} />
          <Tooltip cursor={{ fill: "hsl(var(--secondary))" }} content={<Ayuda unidad={unidad} />} />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]} fill={COLOR.ucc}>
            <LabelList dataKey="valor" position="top" formatter={fmt} fontSize={11} fill="hsl(var(--muted-foreground))" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Barras horizontales de una sola serie, ordenadas; las destacadas van en azul y el resto en azul claro */
export function GraficaBarras({ datos, unidad, titulo, anchoEtiqueta = 170 }: { datos: Punto[]; unidad: string; titulo: string; anchoEtiqueta?: number }) {
  const hayDestacado = datos.some((d) => d.destacado);
  return (
    <figure aria-label={titulo}>
      <ResponsiveContainer width="100%" height={Math.max(120, datos.length * 30 + 20)}>
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="etiqueta" width={anchoEtiqueta} tickLine={false} axisLine={false} fontSize={12} interval={0} />
          <Tooltip cursor={{ fill: "hsl(var(--secondary))" }} content={<Ayuda unidad={unidad} />} />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
            {datos.map((d) => (
              <Cell key={d.etiqueta} fill={!hayDestacado || d.destacado ? COLOR.ucc : COLOR.uccClaro} />
            ))}
            <LabelList dataKey="valor" position="right" formatter={fmt} fontSize={11} fill="hsl(var(--muted-foreground))" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
