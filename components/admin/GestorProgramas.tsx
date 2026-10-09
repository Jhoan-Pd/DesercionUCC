"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { enviarJson } from "@/lib/cliente-api";
import { formatoCOP } from "@/lib/utils";

export interface ProgramaFila {
  id: string;
  nombre: string;
  facultad: string;
  duracionSemestres: number;
  valorSemestre: number;
  activo: boolean;
  estudiantes: number;
  estudiantesActivos: number;
  salarioEnganche: number | null;
}

interface Formulario {
  nombre: string;
  facultad: string;
  duracionSemestres: string;
  valorSemestre: string;
  salarioEnganche: string;
}

const VACIO: Formulario = { nombre: "", facultad: "", duracionSemestres: "10", valorSemestre: "", salarioEnganche: "" };
const aNumero = (v: string) => Number(v.replace(/[.\s$]/g, ""));

export function GestorProgramas({ programas }: { programas: ProgramaFila[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<ProgramaFila | "nuevo" | null>(null);
  const [eliminando, setEliminando] = useState<ProgramaFila | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  function abrir(p: ProgramaFila | "nuevo") {
    setError(null);
    setEditando(p);
    setForm(
      p === "nuevo"
        ? VACIO
        : { nombre: p.nombre, facultad: p.facultad, duracionSemestres: String(p.duracionSemestres), valorSemestre: String(p.valorSemestre), salarioEnganche: p.salarioEnganche ? String(p.salarioEnganche) : "" },
    );
  }

  async function ejecutar(clave: string, accion: () => Promise<unknown>, mensaje: string) {
    setOcupado(clave);
    setError(null);
    try {
      await accion();
      setAviso(mensaje);
      setEditando(null);
      setEliminando(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  }

  function guardar() {
    const cuerpo = {
      nombre: form.nombre,
      facultad: form.facultad,
      duracionSemestres: Number(form.duracionSemestres),
      valorSemestre: aNumero(form.valorSemestre),
      ...(form.salarioEnganche.trim() ? { salarioEnganche: aNumero(form.salarioEnganche) } : {}),
    };
    if (editando === "nuevo") return ejecutar("guardar", () => enviarJson("/api/admin/programas", "POST", cuerpo), `Programa "${form.nombre}" creado.`);
    if (editando) return ejecutar("guardar", () => enviarJson(`/api/admin/programas/${editando.id}`, "PATCH", cuerpo), `Programa "${form.nombre}" actualizado.`);
  }

  const campo = (id: keyof Formulario, etiqueta: string, ayuda?: string, tipo = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`prog-${id}`}>{etiqueta}</Label>
      <Input id={`prog-${id}`} type={tipo} inputMode={tipo === "number" ? "numeric" : undefined} value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })} />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{programas.length} programas · {programas.filter((p) => p.activo).length} activos</p>
        <Button onClick={() => abrir("nuevo")}><Plus className="h-4 w-4" aria-hidden /> Nuevo programa</Button>
      </div>
      {aviso && !editando && !eliminando && <Alert variant="success">{aviso}</Alert>}
      {error && !editando && !eliminando && <Alert variant="error">{error}</Alert>}

      <Table>
        <THead>
          <TR><TH>Programa</TH><TH>Duración</TH><TH>Matrícula/semestre</TH><TH>Salario de enganche</TH><TH>Estudiantes</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></TR>
        </THead>
        <TBody>
          {programas.map((p) => (
            <TR key={p.id} className={p.activo ? undefined : "opacity-60"}>
              <TD><p className="font-medium">{p.nombre}</p><p className="text-xs text-muted-foreground">{p.facultad}</p></TD>
              <TD className="tabular-nums">{p.duracionSemestres} sem.</TD>
              <TD className="tabular-nums">{formatoCOP(p.valorSemestre)}</TD>
              <TD className="tabular-nums">{p.salarioEnganche ? formatoCOP(p.salarioEnganche) : <span className="text-xs text-muted-foreground">General</span>}</TD>
              <TD className="tabular-nums">{p.estudiantes.toLocaleString("es-CO")} <span className="text-xs text-muted-foreground">({p.estudiantesActivos} activos)</span></TD>
              <TD>{p.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="muted">Inactivo</Badge>}</TD>
              <TD>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => abrir(p)} aria-label={`Editar ${p.nombre}`}><Pencil className="h-4 w-4" aria-hidden /></Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={ocupado !== null}
                    onClick={() => ejecutar(`activo-${p.id}`, () => enviarJson(`/api/admin/programas/${p.id}`, "PATCH", { activo: !p.activo }), `Programa "${p.nombre}" ${p.activo ? "desactivado" : "activado"}.`)}
                    aria-label={`${p.activo ? "Desactivar" : "Activar"} ${p.nombre}`}
                    title={p.activo ? "Desactivar (deja de ofrecerse en la calculadora)" : "Activar"}
                  >
                    {ocupado === `activo-${p.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Power className="h-4 w-4" aria-hidden />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setError(null); setEliminando(p); }} aria-label={`Eliminar ${p.nombre}`}><Trash2 className="h-4 w-4 text-destructive" aria-hidden /></Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === "nuevo" ? "Nuevo programa" : "Editar programa"} descripcion="Los valores se usan en la calculadora de impacto y en el impacto institucional.">
        <div className="space-y-3">
          {campo("nombre", "Nombre")}
          {campo("facultad", "Facultad")}
          <div className="grid gap-3 sm:grid-cols-2">
            {campo("duracionSemestres", "Duración (semestres)", undefined, "number")}
            {campo("valorSemestre", "Matrícula por semestre (COP)", "Ej. 4300000")}
          </div>
          {campo("salarioEnganche", "Salario de enganche del egresado (COP, opcional)", "Si se deja vacío se usa el salario profesional general. Fuente sugerida: Observatorio Laboral para la Educación.")}
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={ocupado !== null}>{ocupado === "guardar" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Guardar</Button>
          </div>
        </div>
      </Dialog>

      <Dialog abierto={eliminando !== null} onCerrar={() => setEliminando(null)} titulo="Eliminar programa" descripcion={eliminando ? `¿Eliminar "${eliminando.nombre}"? Esta acción no se puede deshacer.` : undefined}>
        <div className="space-y-3">
          {eliminando && eliminando.estudiantes > 0 && (
            <Alert variant="warning">Tiene {eliminando.estudiantes} estudiantes con historia académica, así que no se puede eliminar. Desactívalo para que deje de ofrecerse.</Alert>
          )}
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEliminando(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={ocupado !== null || (eliminando?.estudiantes ?? 0) > 0}
              onClick={() => eliminando && ejecutar("eliminar", () => enviarJson(`/api/admin/programas/${eliminando.id}`, "DELETE"), `Programa "${eliminando.nombre}" eliminado.`)}
            >
              {ocupado === "eliminar" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Eliminar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
