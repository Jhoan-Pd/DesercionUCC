"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, CheckCircle2, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { enviarJson } from "@/lib/cliente-api";
import type { ResumenModelos, VersionModeloDTO } from "@/services/riesgo/ServicioModelo";

const dec = (v: number | null, d = 3) => (v === null ? "—" : v.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }) : "—";
const origen = (o: string) => (o === "PYTHON_SKLEARN" ? "Python · scikit-learn" : o === "ENTRENAMIENTO_ADMIN" ? "Panel de administración" : o);

const RECOMENDACION: Record<string, { texto: string; variante: "success" | "warning" | "danger" }> = {
  ACTIVAR: { texto: "Recomendado activar", variante: "success" },
  REVISAR: { texto: "Revisar antes de activar", variante: "warning" },
  NO_ACTIVAR: { texto: "No recomendado", variante: "danger" },
};

interface ResultadoActivacion {
  version: string;
  anterior: string | null;
  yaEstabaActiva: boolean;
  recalculo: { estudiantes: number; alto: number; medio: number; alertasNuevas: number } | null;
}

/** Solo se resalta una diferencia que se alcanza a ver con los decimales mostrados (si no, es un empate) */
function comparar(nuevo: number, actual: number, decimales: number, mejorEs: "mayor" | "menor"): boolean | null {
  const f = 10 ** decimales;
  const n = Math.round(nuevo * f);
  const a = Math.round(actual * f);
  if (n === a) return null;
  return mejorEs === "mayor" ? n > a : n < a;
}

function Comparacion({ v }: { v: VersionModeloDTO }) {
  const c = v.comparacion;
  if (!c) return <p className="text-sm text-muted-foreground">No había un modelo activo con el cual comparar.</p>;
  const filas: { metrica: string; ayuda: string; actual: string; nuevo: string; mejor: boolean | null }[] = [
    { metrica: "AUC", ayuda: "mayor es mejor", actual: dec(c.auc.actual), nuevo: dec(c.auc.nuevo), mejor: comparar(c.auc.nuevo, c.auc.actual, 3, "mayor") },
    { metrica: "Brier", ayuda: "menor es mejor", actual: dec(c.brier.actual, 4), nuevo: dec(c.brier.nuevo, 4), mejor: comparar(c.brier.nuevo, c.brier.actual, 4, "menor") },
    { metrica: "Sensibilidad ALTO", ayuda: "desertores detectados", actual: pct(c.sensibilidadAlto.actual), nuevo: pct(c.sensibilidadAlto.nuevo), mejor: null },
    { metrica: "Precisión ALTO", ayuda: "aciertos al marcar ALTO", actual: pct(c.precisionAlto.actual), nuevo: pct(c.precisionAlto.nuevo), mejor: null },
  ];
  return (
    <Table>
      <THead>
        <TR><TH>Métrica (mismas filas de prueba)</TH><TH>Activo · {c.versionActual}</TH><TH>Nuevo · {v.version}</TH></TR>
      </THead>
      <TBody>
        {filas.map((f) => (
          <TR key={f.metrica}>
            <TD><p className="font-medium">{f.metrica}</p><p className="text-xs text-muted-foreground">{f.ayuda}</p></TD>
            <TD className="tabular-nums">{f.actual}</TD>
            <TD className={`tabular-nums ${f.mejor === true ? "font-semibold text-green-800" : f.mejor === false ? "font-semibold text-amber-800" : ""}`}>{f.nuevo}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export function GestorModelo({ resumen }: { resumen: ResumenModelos }) {
  const router = useRouter();
  const [C, setC] = useState("1");
  const [entrenando, setEntrenando] = useState(false);
  const [nueva, setNueva] = useState<VersionModeloDTO | null>(null);
  const [confirmar, setConfirmar] = useState<VersionModeloDTO | null>(null);
  const [activando, setActivando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const activo = resumen.activo;

  async function entrenar() {
    setEntrenando(true);
    setError(null);
    setAviso(null);
    try {
      const v = await enviarJson<VersionModeloDTO>("/api/admin/modelo", "POST", { C: Number(C) });
      setNueva(v);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible entrenar el modelo.");
    } finally {
      setEntrenando(false);
    }
  }

  async function activar(v: VersionModeloDTO) {
    setActivando(true);
    setError(null);
    try {
      const r = await enviarJson<ResultadoActivacion>(`/api/admin/modelo/${v.id}/activar`, "POST", { recalcular: true });
      const rc = r.recalculo;
      setAviso(
        `Versión ${r.version} activa${r.anterior && r.anterior !== r.version ? ` (antes: ${r.anterior})` : ""}.` +
          (rc ? ` Se recalcularon ${rc.estudiantes.toLocaleString("es-CO")} estudiantes: ${rc.alto} en riesgo ALTO, ${rc.medio} MEDIO y ${rc.alertasNuevas} alertas nuevas.` : ""),
      );
      setConfirmar(null);
      setNueva(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible activar la versión.");
    } finally {
      setActivando(false);
    }
  }

  async function recalcular() {
    setRecalculando(true);
    setError(null);
    try {
      const r = await enviarJson<{ estudiantes: number; alto: number; medio: number; alertasNuevas: number; version: string }>("/api/riesgo/recalcular", "POST", {});
      setAviso(`Puntajes recalculados con ${r.version}: ${r.estudiantes.toLocaleString("es-CO")} estudiantes, ${r.alto} en ALTO, ${r.alertasNuevas} alertas nuevas.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible recalcular los puntajes.");
    } finally {
      setRecalculando(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {aviso && <Alert variant="success">{aviso}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4 text-primary" aria-hidden /> Modelo activo</CardTitle>
            <CardDescription>Es el que calcula los puntajes de la alerta temprana.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activo ? (
              <>
                <div>
                  <p className="font-mono text-sm font-semibold">{activo.version}</p>
                  <p className="text-xs text-muted-foreground">{origen(activo.origen)} · {fecha(activo.creadoEn)}{activo.entrenadoPor ? ` · ${activo.entrenadoPor}` : ""}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">AUC (prueba)</dt><dd className="text-lg font-semibold tabular-nums">{dec(activo.auc)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Brier</dt><dd className="text-lg font-semibold tabular-nums">{dec(activo.brier, 4)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Sensibilidad ALTO</dt><dd className="text-lg font-semibold tabular-nums">{pct(activo.sensibilidadAlto)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Tasa base</dt><dd className="text-lg font-semibold tabular-nums">{pct(activo.tasaBase)}</dd></div>
                </dl>
              </>
            ) : (
              <Alert variant="warning">No hay una versión activa en la base de datos: se usa el modelo exportado desde Python que viene con el código.</Alert>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-secondary/60 p-3 text-sm">
              <p>
                <span className="font-medium">{resumen.puntajes.total.toLocaleString("es-CO")}</span> puntajes en el periodo actual
                {resumen.puntajes.version ? <> · versión <span className="font-mono text-xs">{resumen.puntajes.version}</span></> : null}
                <span className="block text-xs text-muted-foreground">Último cálculo: {fecha(resumen.puntajes.calculadoEn)}</span>
              </p>
              <Button variant="outline" size="sm" onClick={recalcular} disabled={recalculando}>
                {recalculando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />} Recalcular puntajes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" aria-hidden /> Reentrenar con los datos actuales</CardTitle>
            <CardDescription>
              Útil después de importar datos reales o al cerrar un periodo. Usa el mismo procedimiento que el script de Python: separa el 20 % de los estudiantes para evaluar, ajusta la regresión logística y la compara con la versión activa. La versión nueva queda inactiva hasta que la actives.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="regularizacion">Regularización (C)</Label>
              <Select id="regularizacion" value={C} onChange={(e) => setC(e.target.value)} disabled={entrenando}>
                <option value="0.1">0,1 · más regularización (coeficientes más pequeños)</option>
                <option value="1">1 · valor por defecto de scikit-learn</option>
                <option value="10">10 · menos regularización</option>
              </Select>
            </div>
            <Button onClick={entrenar} disabled={entrenando}>
              {entrenando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              {entrenando ? "Entrenando…" : "Entrenar nueva versión"}
            </Button>
            {entrenando && <p className="text-xs text-muted-foreground">Esto toma unos segundos: se procesan todas las filas estudiante-semestre.</p>}
          </CardContent>
        </Card>
      </div>

      {nueva && (
        <Card className="border-primary/40">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle>Resultado del entrenamiento · <span className="font-mono">{nueva.version}</span></CardTitle>
              <CardDescription>
                AUC fuera de muestra: <b>{dec(nueva.auc)}</b> sobre {nueva.filasPrueba?.toLocaleString("es-CO") ?? "—"} filas de estudiantes que el modelo no vio al ajustarse.
              </CardDescription>
            </div>
            {nueva.recomendacion && <Badge variant={RECOMENDACION[nueva.recomendacion].variante}>{RECOMENDACION[nueva.recomendacion].texto}</Badge>}
          </CardHeader>
          <CardContent className="space-y-5">
            {nueva.motivo && <p className="text-sm">{nueva.motivo}</p>}
            <Comparacion v={nueva} />
            <div>
              <p className="mb-2 text-sm font-semibold">Variables con más peso en la versión nueva</p>
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {nueva.coeficientesPrincipales.map((c) => (
                  <li key={c.clave} className="flex justify-between gap-3 rounded border px-3 py-1.5">
                    <span>{c.etiqueta}</span>
                    <span className={`tabular-nums font-medium ${c.coeficiente > 0 ? "text-red-800" : "text-green-800"}`}>
                      {c.coeficiente > 0 ? "↑ riesgo" : "↓ riesgo"} {dec(Math.abs(c.coeficiente), 2)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Coeficientes sobre variables estandarizadas: comparables entre sí. Revisa que los signos tengan sentido antes de activar.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setConfirmar(nueva)}><CheckCircle2 className="h-4 w-4" aria-hidden /> Activar esta versión</Button>
              <Button variant="outline" onClick={() => setNueva(null)}>Conservar la versión actual</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de versiones</CardTitle>
          <CardDescription>
            Puedes volver a una versión anterior en cualquier momento; los puntajes se recalculan al activarla. El AUC y el Brier de cada fila se midieron en la partición de prueba de su propio entrenamiento (Python y el panel separan estudiantes distintos), así que para decidir entre dos versiones usa la comparación sobre las mismas filas que aparece al entrenar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR><TH>Versión</TH><TH>Origen</TH><TH>Fecha</TH><TH>AUC</TH><TH>Brier</TH><TH>Estado</TH><TH><span className="sr-only">Acciones</span></TH></TR>
            </THead>
            <TBody>
              {resumen.versiones.length === 0 && (
                <TR><TD colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Aún no hay versiones registradas.</TD></TR>
              )}
              {resumen.versiones.map((v) => (
                <TR key={v.id}>
                  <TD><p className="font-mono text-xs font-semibold">{v.version}</p>{v.entrenadoPor && <p className="text-xs text-muted-foreground">{v.entrenadoPor}</p>}</TD>
                  <TD className="text-sm">{origen(v.origen)}</TD>
                  <TD className="whitespace-nowrap text-sm">{fecha(v.creadoEn)}</TD>
                  <TD className="tabular-nums">{dec(v.auc)}</TD>
                  <TD className="tabular-nums">{dec(v.brier, 4)}</TD>
                  <TD>{v.activo ? <Badge variant="success">Activa</Badge> : v.recomendacion ? <Badge variant={RECOMENDACION[v.recomendacion].variante}>{RECOMENDACION[v.recomendacion].texto}</Badge> : <Badge variant="muted">Inactiva</Badge>}</TD>
                  <TD className="text-right">
                    {!v.activo && (
                      <Button variant="outline" size="sm" onClick={() => setConfirmar(v)} aria-label={`Activar la versión ${v.version}`}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Activar
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        abierto={confirmar !== null}
        onCerrar={() => !activando && setConfirmar(null)}
        titulo={`¿Activar la versión ${confirmar?.version ?? ""}?`}
        descripcion="Se reemplaza el modelo activo y se recalculan los puntajes de todos los estudiantes activos y aplazados; las alertas nuevas se crean para quienes queden en riesgo ALTO."
      >
        {confirmar?.recomendacion && confirmar.recomendacion !== "ACTIVAR" && (
          <Alert variant="warning" className="mb-4">{confirmar.motivo ?? "Esta versión no es la recomendada."}</Alert>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmar(null)} disabled={activando}>Cancelar</Button>
          <Button onClick={() => confirmar && activar(confirmar)} disabled={activando}>
            {activando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {activando ? "Activando…" : "Sí, activar y recalcular"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
