"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Upload, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { ResultadoImportacion, VistaPrevia } from "@/services/importacion/ServicioImportacion";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Excel en Windows guarda los CSV en Windows-1252 (ANSI) y no en UTF-8. Se intenta UTF-8 estricto
 * y, si el archivo no lo es, se lee como Windows-1252 para no dañar tildes ni eñes.
 */
function decodificar(buffer: ArrayBuffer): { texto: string; codificacion: string } {
  try {
    return { texto: new TextDecoder("utf-8", { fatal: true }).decode(buffer), codificacion: "UTF-8" };
  } catch {
    return { texto: new TextDecoder("windows-1252").decode(buffer), codificacion: "Windows-1252 (ANSI de Excel)" };
  }
}

function Dato({ etiqueta, valor, tono }: { etiqueta: string; valor: number | string; tono?: "bien" | "mal" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className={`text-xl font-bold tabular-nums ${tono === "mal" ? "text-destructive" : tono === "bien" ? "text-green-700" : ""}`}>
        {typeof valor === "number" ? valor.toLocaleString("es-CO") : valor}
      </p>
    </div>
  );
}

export function ImportadorArchivo() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<{ nombre: string; contenido: string; codificacion: string } | null>(null);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<"validando" | "importando" | null>(null);

  async function enviar(confirmar: boolean, datos = archivo) {
    if (!datos) return;
    setError(null);
    setCargando(confirmar ? "importando" : "validando");
    try {
      const res = await fetch("/api/admin/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivo: datos.nombre, contenido: datos.contenido, confirmar }),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error ?? "No se pudo procesar el archivo.");
      if (confirmar) {
        setResultado(cuerpo as ResultadoImportacion);
        setVista(null);
        setArchivo(null);
        if (entrada.current) entrada.current.value = "";
        router.refresh();
      } else setVista(cuerpo as VistaPrevia);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar el archivo.");
    } finally {
      setCargando(null);
    }
  }

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setVista(null);
    setResultado(null);
    setError(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setError("El archivo debe tener extensión .csv (en Excel: Archivo → Guardar como → CSV).");
    if (f.size > MAX_BYTES) return setError("El archivo supera 5 MB; divídelo en varios archivos.");
    const { texto, codificacion } = decodificar(await f.arrayBuffer());
    const datos = { nombre: f.name, contenido: texto, codificacion };
    setArchivo(datos);
    await enviar(false, datos);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Cargar y revisar el archivo</CardTitle>
        <CardDescription>Primero se valida sin guardar nada. Solo si no hay errores podrás confirmar la importación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label
          htmlFor="archivo-csv"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-input p-6 text-center hover:bg-secondary/40"
        >
          <FileUp className="h-8 w-8 text-primary" aria-hidden />
          <span className="text-sm font-medium">{archivo ? archivo.nombre : "Elegir archivo .csv"}</span>
          <span className="text-xs text-muted-foreground">
            {archivo ? `Codificación detectada: ${archivo.codificacion}` : "Máximo 5 MB y 10.000 filas. Separador ; o , (se detecta solo)."}
          </span>
          <input id="archivo-csv" ref={entrada} type="file" accept=".csv,text/csv" className="sr-only" onChange={alElegir} disabled={cargando !== null} />
        </label>

        {cargando === "validando" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Validando el archivo...</p>
        )}
        {error && <Alert variant="error" titulo="No se pudo procesar el archivo">{error}</Alert>}

        {resultado && (
          <Alert variant="success" titulo="Importación completada">
            Se importaron {resultado.filas.toLocaleString("es-CO")} filas: {resultado.estudiantesNuevos.toLocaleString("es-CO")} estudiantes nuevos y{" "}
            {resultado.estudiantesActualizados.toLocaleString("es-CO")} actualizados ({resultado.semestres.toLocaleString("es-CO")} semestres, {resultado.desertores} desertores).
            {resultado.riesgo
              ? ` Se recalcularon los puntajes de riesgo de ${resultado.riesgo.estudiantes.toLocaleString("es-CO")} estudiantes (${resultado.riesgo.alto} en riesgo alto, ${resultado.riesgo.alertasNuevas} alertas nuevas).`
              : " No se pudieron recalcular los puntajes de riesgo; hazlo desde Alerta temprana."}
          </Alert>
        )}

        {vista && (
          <div className="space-y-5" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Dato etiqueta="Filas" valor={vista.resumen.filas} />
              <Dato etiqueta="Estudiantes" valor={vista.resumen.estudiantes} />
              <Dato etiqueta="Nuevos" valor={vista.nuevos} />
              <Dato etiqueta="Se actualizan" valor={vista.actualizados} />
              <Dato etiqueta="Semestres" valor={vista.resumen.semestres} />
              <Dato etiqueta="Errores" valor={vista.totalErrores} tono={vista.totalErrores ? "mal" : "bien"} />
            </div>

            {vista.columnasIgnoradas.length > 0 && (
              <Alert variant="warning">Columnas que no se usan y se ignorarán: {vista.columnasIgnoradas.join(", ")}.</Alert>
            )}

            {vista.valido ? (
              <Alert variant="success" titulo="El archivo es válido">
                {vista.actualizados > 0
                  ? `Atención: ${vista.actualizados} estudiante(s) ya existen; su trayectoria completa (matrículas, notas, financiación y retiro) se reemplazará con la del archivo.`
                  : "Todos los estudiantes son nuevos."}
              </Alert>
            ) : (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <XCircle className="h-4 w-4" aria-hidden /> Corrige estos errores en el archivo y vuelve a cargarlo
                  {vista.totalErrores > vista.errores.length && ` (se muestran ${vista.errores.length} de ${vista.totalErrores.toLocaleString("es-CO")})`}:
                </p>
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <Table>
                    <THead><TR><TH>Fila</TH><TH>Columna</TH><TH>Valor</TH><TH>Problema</TH></TR></THead>
                    <TBody>
                      {vista.errores.map((e, i) => (
                        <TR key={i}>
                          <TD className="tabular-nums">{e.linea}</TD>
                          <TD><code className="text-xs">{e.columna || "—"}</code></TD>
                          <TD className="max-w-[160px] truncate text-xs">{e.valor || "(vacío)"}</TD>
                          <TD className="text-sm">{e.mensaje}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </div>
            )}

            {vista.muestra.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Primeros estudiantes leídos</p>
                <Table>
                  <THead><TR><TH>Código</TH><TH>Programa</TH><TH>Cohorte</TH><TH>Estado</TH><TH>Semestres</TH><TH>Acción</TH></TR></THead>
                  <TBody>
                    {vista.muestra.map((m) => (
                      <TR key={m.codigo}>
                        <TD className="font-mono text-xs">{m.codigo}</TD>
                        <TD>{m.programa}</TD>
                        <TD>{m.cohorte}</TD>
                        <TD>{m.estado}</TD>
                        <TD className="tabular-nums">{m.semestres}</TD>
                        <TD>{m.existe ? <Badge variant="warning">Actualizar</Badge> : <Badge variant="success">Nuevo</Badge>}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              <span className="text-sm text-muted-foreground">
                {vista.valido ? "3. Confirma para guardar los datos." : "No se puede importar mientras haya errores."}
              </span>
              <Button onClick={() => enviar(true)} disabled={!vista.valido || cargando !== null}>
                {cargando === "importando" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : vista.valido ? <Upload className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                {cargando === "importando" ? "Importando..." : "Confirmar importación"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
