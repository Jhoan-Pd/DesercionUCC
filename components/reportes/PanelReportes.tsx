"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, HeartHandshake, Landmark, ShieldAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BotonDescarga } from "./BotonDescarga";

type Tipo = "institucional" | "riesgo" | "intervenciones" | "impacto-institucional";

const REPORTES: { tipo: Tipo; titulo: string; descripcion: string; contenido: string[]; porPrograma: boolean; icono: React.ReactNode }[] = [
  {
    tipo: "institucional",
    titulo: "Reporte institucional de deserción",
    descripcion: "Lo mismo que el dashboard, listo para presentar a directivas.",
    contenido: ["Indicadores clave vs. referencia nacional", "Por programa, cohorte, semestre y periodo", "Supervivencia (Kaplan-Meier)", "Causas (categorías MEN) y municipios"],
    porPrograma: true,
    icono: <Building2 className="h-5 w-5" aria-hidden />,
  },
  {
    tipo: "riesgo",
    titulo: "Lista priorizada de riesgo",
    descripcion: "Estudiantes con riesgo alto y medio para planear el acompañamiento.",
    contenido: ["Código anónimo, programa y semestre", "Puntaje 0-100 y nivel", "Factores que más pesan", "Alertas abiertas e intervenciones en curso"],
    porPrograma: true,
    icono: <ShieldAlert className="h-5 w-5" aria-hidden />,
  },
  {
    tipo: "intervenciones",
    titulo: "Efectividad de las intervenciones",
    descripcion: "¿Los estudiantes acompañados permanecen más? Comparación ajustada por riesgo.",
    contenido: ["Efecto ajustado con intervalo de confianza", "Permanencia por franja de riesgo", "Efecto por tipo de intervención", "Cobertura por periodo"],
    porPrograma: false,
    icono: <HeartHandshake className="h-5 w-5" aria-hidden />,
  },
  {
    tipo: "impacto-institucional",
    titulo: "Impacto institucional y regional",
    descripcion: "Costo de la deserción para la UCC y para la región.",
    contenido: ["Matrícula no percibida por programa y año", "Graduación por cohorte", "Pérdida de ingresos por municipio", "Proyección con reducción del 10, 20 y 30 %"],
    porPrograma: true,
    icono: <Landmark className="h-5 w-5" aria-hidden />,
  },
];

export function PanelReportes({ programas }: { programas: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [programaId, setProgramaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const programa = programas.find((p) => p.id === programaId)?.nombre;

  const url = (tipo: Tipo, formato: "pdf" | "xlsx", porPrograma: boolean) => {
    const q = new URLSearchParams({ formato });
    if (porPrograma && programaId) q.set("programaId", programaId);
    return `/api/reportes/${tipo}?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <section aria-label="Filtro" className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div className="min-w-[240px] flex-1 space-y-1.5 sm:max-w-sm">
          <Label htmlFor="programa-reporte" className="text-xs text-muted-foreground">Programa (aplica a los reportes que lo permiten)</Label>
          <Select id="programa-reporte" value={programaId} onChange={(e) => setProgramaId(e.target.value)}>
            <option value="">Toda la universidad</option>
            {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Cada exportación queda registrada en la auditoría con tu rol, el tipo de reporte y los filtros.</p>
      </section>

      {error && <Alert variant="error" titulo="No se pudo generar el reporte">{error}</Alert>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {REPORTES.map((r) => (
          <Card key={r.tipo} className="flex flex-col">
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <span className="rounded-lg bg-secondary p-2 text-primary">{r.icono}</span>
              <div className="space-y-1">
                <CardTitle>{r.titulo}</CardTitle>
                <CardDescription>{r.descripcion}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {r.contenido.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <span className="text-xs text-muted-foreground">
                  {r.porPrograma ? (programa ? `Filtrado: ${programa}` : "Toda la universidad") : "Toda la universidad (sin filtro)"}
                </span>
                <div className="flex gap-2">
                  <BotonDescarga url={url(r.tipo, "pdf", r.porPrograma)} formato="pdf" onError={setError} onDescargado={() => router.refresh()} />
                  <BotonDescarga url={url(r.tipo, "xlsx", r.porPrograma)} formato="xlsx" onError={setError} onDescargado={() => router.refresh()} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
