"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellPlus, CheckCircle2, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { CursoDocente, EstudianteCurso } from "@/services/docente/ServicioDocente";

const MOTIVOS = [
  "Bajo rendimiento en el curso",
  "Inasistencia reiterada",
  "Desmotivación o cambio de actitud",
  "Manifestó dificultades económicas o personales",
  "Otro",
];

interface Props {
  cursos: CursoDocente[];
  docentes: { id: string; nombre: string }[];
  docenteSeleccionado?: string;
  umbrales: { nota: number; asistencia: number };
}

export function PanelDocente({ cursos, docentes, docenteSeleccionado, umbrales }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [cursoId, setCursoId] = useState(cursos[0]?.id ?? "");
  const [soloSenales, setSoloSenales] = useState(false);
  const [reportando, setReportando] = useState<EstudianteCurso | null>(null);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const curso = cursos.find((c) => c.id === cursoId) ?? cursos[0];
  const estudiantes = useMemo(() => (curso ? curso.estudiantes.filter((e) => !soloSenales || e.notaBaja || e.inasistencia) : []), [curso, soloSenales]);

  function abrir(e: EstudianteCurso) {
    setReportando(e);
    setMotivo(e.notaBaja ? MOTIVOS[0] : e.inasistencia ? MOTIVOS[1] : MOTIVOS[2]);
    setDetalle("");
    setError(null);
  }

  async function reportar() {
    if (!reportando || !curso) return;
    setEnviando(true);
    setError(null);
    const senales = [
      reportando.notaParcial !== null ? `nota parcial ${reportando.notaParcial.toLocaleString("es-CO")}` : null,
      `asistencia ${reportando.asistenciaPct.toLocaleString("es-CO")} %`,
    ].filter(Boolean).join(", ");
    const texto = `${motivo} en ${curso.codigo} ${curso.nombre} (${senales}).${detalle.trim() ? ` ${detalle.trim()}` : ""}`;
    try {
      const res = await fetch("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estudianteId: reportando.estudianteId, cursoId: curso.id, motivo: texto.slice(0, 500) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "No se pudo reportar la alerta.");
      setExito(`Alerta enviada a Bienestar Universitario para ${reportando.nombre}.`);
      setReportando(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      {docentes.length > 0 && (
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="docente">Ver el panel del docente</Label>
          <Select id="docente" value={docenteSeleccionado ?? docentes[0]?.id} onChange={(e) => router.push(`${pathname}?docenteId=${e.target.value}`)}>
            {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </Select>
        </div>
      )}

      {exito && <Alert variant="success">{exito}</Alert>}

      {cursos.length === 0 ? (
        <Alert variant="info">No hay cursos asignados en el periodo actual.</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <nav aria-label="Cursos" className="space-y-2">
            <Label htmlFor="curso-movil" className="lg:hidden">Curso</Label>
            <Select id="curso-movil" className="lg:hidden" value={curso?.id} onChange={(e) => setCursoId(e.target.value)}>
              {cursos.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
            </Select>
            <ul className="hidden space-y-2 lg:block">
              {cursos.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setCursoId(c.id)}
                    aria-current={c.id === curso?.id ? "true" : undefined}
                    className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${c.id === curso?.id ? "border-primary bg-primary/5" : "hover:bg-secondary"}`}
                  >
                    <p className="font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.codigo} · {c.programa} · sem. {c.semestre}</p>
                    <p className="mt-1 text-xs">
                      {c.estudiantes.length} estudiantes · <span className={c.conSenales ? "font-semibold text-red-700" : "text-muted-foreground"}>{c.conSenales} con señales</span>
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {curso && (
            <Card>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle>{curso.codigo} · {curso.nombre}</CardTitle>
                  <CardDescription>
                    {curso.programa}, semestre {curso.semestre}. Señales: nota parcial menor a {umbrales.nota.toLocaleString("es-CO")} o asistencia menor al {umbrales.asistencia} %.
                  </CardDescription>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" checked={soloSenales} onChange={(e) => setSoloSenales(e.target.checked)} />
                  Solo con señales
                </label>
              </CardHeader>
              <CardContent>
                {estudiantes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Ningún estudiante con señales en este curso.</p>
                ) : (
                  <Table>
                    <THead>
                      <TR><TH>Estudiante</TH><TH>Nota parcial</TH><TH>Asistencia</TH><TH>Fallas</TH><TH>Señales</TH><TH><span className="sr-only">Acción</span></TH></TR>
                    </THead>
                    <TBody>
                      {estudiantes.map((e) => (
                        <TR key={e.estudianteId}>
                          <TD><p className="font-medium">{e.nombre}</p><p className="text-xs text-muted-foreground">{e.codigo}</p></TD>
                          <TD className={e.notaBaja ? "font-semibold text-red-700" : undefined}>{e.notaParcial === null ? "Sin nota" : e.notaParcial.toLocaleString("es-CO")}</TD>
                          <TD className={e.inasistencia ? "font-semibold text-red-700" : undefined}>{e.asistenciaPct.toLocaleString("es-CO")} %</TD>
                          <TD className="tabular-nums">{e.fallas}</TD>
                          <TD className="text-xs">
                            {[e.notaBaja && "Bajo rendimiento", e.inasistencia && "Inasistencia"].filter(Boolean).join(" · ") || <span className="text-muted-foreground">—</span>}
                          </TD>
                          <TD>
                            {e.alertaAbierta ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Reportado</span>
                            ) : (
                              <Button size="sm" variant={e.notaBaja || e.inasistencia ? "default" : "outline"} onClick={() => abrir(e)}>
                                <BellPlus className="h-3.5 w-3.5" aria-hidden /> Reportar
                              </Button>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog abierto={reportando !== null} onCerrar={() => setReportando(null)} titulo={`Reportar alerta: ${reportando?.nombre ?? ""}`} descripcion="Bienestar Universitario recibirá la alerta y hará el seguimiento. El estudiante no ve este reporte.">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo principal</Label>
            <Select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detalle">Detalle (opcional)</Label>
            <Textarea id="detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={300} placeholder="Ej. No ha entregado los dos últimos trabajos." />
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReportando(null)}>Cancelar</Button>
            <Button onClick={reportar} disabled={enviando}>{enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Enviar alerta</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
