"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { enviarJson } from "@/lib/cliente-api";

export interface PeriodoFila {
  id: string;
  codigo: string;
  anio: number;
  semestre: number;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  matriculas: number;
  ingresos: number;
  retiros: number;
}

type Modo = { tipo: "nuevo" } | { tipo: "fechas"; periodo: PeriodoFila } | { tipo: "activar"; periodo: PeriodoFila } | { tipo: "eliminar"; periodo: PeriodoFila };

export function GestorPeriodos({ periodos }: { periodos: PeriodoFila[] }) {
  const router = useRouter();
  const ultimo = periodos[0];
  const siguiente = ultimo ? (ultimo.semestre === 1 ? { anio: ultimo.anio, semestre: 2 } : { anio: ultimo.anio + 1, semestre: 1 }) : { anio: new Date().getFullYear(), semestre: 1 };
  const fechasSugeridas = (anio: number, semestre: number) =>
    semestre === 1 ? { inicio: `${anio}-02-01`, fin: `${anio}-06-15` } : { inicio: `${anio}-08-01`, fin: `${anio}-12-05` };

  const [modo, setModo] = useState<Modo | null>(null);
  const [anio, setAnio] = useState(String(siguiente.anio));
  const [semestre, setSemestre] = useState(String(siguiente.semestre));
  const [inicio, setInicio] = useState(fechasSugeridas(siguiente.anio, siguiente.semestre).inicio);
  const [fin, setFin] = useState(fechasSugeridas(siguiente.anio, siguiente.semestre).fin);
  const [activar, setActivar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function abrir(m: Modo) {
    setError(null);
    setModo(m);
    if (m.tipo === "fechas") {
      setInicio(m.periodo.fechaInicio);
      setFin(m.periodo.fechaFin);
    }
    if (m.tipo === "nuevo") {
      const f = fechasSugeridas(siguiente.anio, siguiente.semestre);
      setAnio(String(siguiente.anio));
      setSemestre(String(siguiente.semestre));
      setInicio(f.inicio);
      setFin(f.fin);
      setActivar(false);
    }
  }

  async function ejecutar(accion: () => Promise<unknown>, mensaje: string) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      setAviso(mensaje);
      setModo(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  }

  const fechas = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="per-inicio">Inicio de clases</Label><Input id="per-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="per-fin">Fin del periodo</Label><Input id="per-fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} /></div>
    </div>
  );
  const pie = (texto: string, accion: () => void, variante: "default" | "destructive" = "default") => (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setModo(null)}>Cancelar</Button>
        <Button variant={variante} onClick={accion} disabled={ocupado}>{ocupado && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{texto}</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Periodo actual: <b className="text-foreground">{periodos.find((p) => p.activo)?.codigo ?? "ninguno"}</b></p>
        <Button onClick={() => abrir({ tipo: "nuevo" })}><Plus className="h-4 w-4" aria-hidden /> Nuevo periodo</Button>
      </div>
      {aviso && !modo && (
        <Alert variant="success">
          {aviso}{" "}
          {aviso.includes("activ") && <Link href="/alerta-temprana" className="font-medium underline">Recalcula los puntajes de riesgo</Link>}
        </Alert>
      )}

      <Table>
        <THead><TR><TH>Periodo</TH><TH>Inicio</TH><TH>Fin</TH><TH>Matrículas</TH><TH>Ingresos (cohorte)</TH><TH>Retiros</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></TR></THead>
        <TBody>
          {periodos.map((p) => {
            const usado = p.matriculas + p.ingresos + p.retiros > 0;
            return (
              <TR key={p.id}>
                <TD className="font-medium">{p.codigo}</TD>
                <TD className="tabular-nums">{p.fechaInicio}</TD>
                <TD className="tabular-nums">{p.fechaFin}</TD>
                <TD className="tabular-nums">{p.matriculas.toLocaleString("es-CO")}</TD>
                <TD className="tabular-nums">{p.ingresos.toLocaleString("es-CO")}</TD>
                <TD className="tabular-nums">{p.retiros.toLocaleString("es-CO")}</TD>
                <TD>{p.activo ? <Badge variant="success">Actual</Badge> : <Badge variant="muted">Cerrado</Badge>}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => abrir({ tipo: "fechas", periodo: p })} aria-label={`Editar fechas de ${p.codigo}`}><Pencil className="h-4 w-4" aria-hidden /></Button>
                    {!p.activo && <Button variant="ghost" size="sm" onClick={() => abrir({ tipo: "activar", periodo: p })} aria-label={`Activar ${p.codigo}`} title="Marcar como periodo actual"><CalendarCheck className="h-4 w-4" aria-hidden /></Button>}
                    {!p.activo && !usado && <Button variant="ghost" size="sm" onClick={() => abrir({ tipo: "eliminar", periodo: p })} aria-label={`Eliminar ${p.codigo}`}><Trash2 className="h-4 w-4 text-destructive" aria-hidden /></Button>}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Dialog abierto={modo?.tipo === "nuevo"} onCerrar={() => setModo(null)} titulo="Nuevo periodo académico">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="per-anio">Año</Label><Input id="per-anio" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="per-semestre">Semestre</Label>
              <Select id="per-semestre" value={semestre} onChange={(e) => setSemestre(e.target.value)}><option value="1">1 (primer semestre)</option><option value="2">2 (segundo semestre)</option></Select>
            </div>
          </div>
          {fechas}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={activar} onChange={(e) => setActivar(e.target.checked)} />
            <span>Marcar como periodo actual (el periodo activo anterior se cerrará)</span>
          </label>
          {pie("Crear periodo", () =>
            ejecutar(
              () => enviarJson("/api/admin/periodos", "POST", { anio: Number(anio), semestre: Number(semestre), fechaInicio: inicio, fechaFin: fin, activo: activar }),
              `Periodo ${anio}-${semestre} creado${activar ? " y activado." : "."}`,
            ),
          )}
        </div>
      </Dialog>

      <Dialog abierto={modo?.tipo === "fechas"} onCerrar={() => setModo(null)} titulo={modo?.tipo === "fechas" ? `Fechas del periodo ${modo.periodo.codigo}` : ""}>
        <div className="space-y-3">
          {fechas}
          {modo?.tipo === "fechas" && pie("Guardar", () => ejecutar(() => enviarJson(`/api/admin/periodos/${modo.periodo.id}`, "PATCH", { fechaInicio: inicio, fechaFin: fin }), `Fechas de ${modo.periodo.codigo} actualizadas.`))}
        </div>
      </Dialog>

      <Dialog
        abierto={modo?.tipo === "activar"}
        onCerrar={() => setModo(null)}
        titulo={modo?.tipo === "activar" ? `Activar ${modo.periodo.codigo}` : ""}
        descripcion="El periodo actual define qué semestre está en curso para el dashboard, la alerta temprana y el panel docente."
      >
        {modo?.tipo === "activar" && (
          <div className="space-y-3">
            <Alert variant="warning">El periodo activo actual se cerrará. Después recalcula los puntajes de riesgo en Alerta temprana para que la lista priorizada corresponda al nuevo periodo.</Alert>
            {pie("Activar periodo", () => ejecutar(() => enviarJson(`/api/admin/periodos/${modo.periodo.id}`, "PATCH", { activo: true }), `Periodo ${modo.periodo.codigo} activado.`))}
          </div>
        )}
      </Dialog>

      <Dialog abierto={modo?.tipo === "eliminar"} onCerrar={() => setModo(null)} titulo={modo?.tipo === "eliminar" ? `Eliminar ${modo.periodo.codigo}` : ""} descripcion="Solo se pueden eliminar periodos sin información académica.">
        {modo?.tipo === "eliminar" && pie("Eliminar", () => ejecutar(() => enviarJson(`/api/admin/periodos/${modo.periodo.id}`, "DELETE"), `Periodo ${modo.periodo.codigo} eliminado.`), "destructive")}
      </Dialog>
    </div>
  );
}
