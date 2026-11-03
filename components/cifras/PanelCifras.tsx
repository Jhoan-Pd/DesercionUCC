import { ExternalLink, Landmark } from "lucide-react";
import type { ResumenUccPasto } from "@/lib/datos-abiertos";
import type { OrigenDatos } from "@/lib/datos-abiertos-remotos";
import { formatoFechaHora, formatoNumero, formatoPorcentaje } from "@/lib/formato";
import { Indicador } from "@/components/comunes/Indicador";
import { GraficaBarras, GraficaColumnas } from "@/components/graficas/Graficas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const pct = (v: number | null) => (v === null ? "—" : formatoPorcentaje(v, { decimales: 1, signo: true }));

/**
 * Cifras oficiales y agregadas de la UCC (Ministerio de Educación, datos.gov.co). Es un componente de
 * servidor que no sabe cómo se generó la página: lo usan la página pública /datos-abiertos (ISR) y la
 * sección «Cifras UCC» del observatorio (SSR con sesión). Mismo componente, dos patrones de rendering.
 */
export function PanelCifras({ r, origen }: { r: ResumenUccPasto; origen: OrigenDatos }) {
  const pregrado = r.programas.filter((p) => p.nivel === "Pregrado");
  const posgrado = r.programas.filter((p) => p.nivel === "Posgrado");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0 sm:gap-5 xl:grid-cols-4">
        <Indicador etiqueta={`Matriculados en Pasto (${r.ultimo.anio})`} valor={formatoNumero(r.ultimo.total)} nota={`${formatoNumero(r.ultimo.pregrado)} en pregrado y ${formatoNumero(r.ultimo.posgrado)} en posgrado`} />
        <Indicador etiqueta={`Cambio frente a ${r.primero.anio}`} valor={pct(r.variacionPasto)} nota={`${formatoNumero(r.primero.total)} matriculados en ${r.primero.anio}`} />
        <Indicador etiqueta={`Cambio de toda la UCC (${r.nacional[0].anio}-${r.nacional[r.nacional.length - 1].anio})`} valor={pct(r.variacionNacional)} nota={`${formatoNumero(r.nacional[r.nacional.length - 1].total)} matriculados en todas las sedes`} />
        <Indicador etiqueta={`Sede Pasto entre ${r.campus.length} sedes`} valor={`${r.posicionPasto}.ª`} nota={`por número de matriculados en ${r.anioCampus}`} />
      </div>

      <div className="grid gap-5 [&>*]:min-w-0 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>matriculados en la sede Pasto por año.</CardTitle>
            <CardDescription>Primer semestre de cada año · todos los programas</CardDescription>
          </CardHeader>
          <CardContent>
            <GraficaColumnas titulo="Matriculados en la sede Pasto por año" unidad="matriculados" datos={r.porAnio.map((a) => ({ etiqueta: String(a.anio), valor: a.total }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>matriculados por sede de la UCC ({r.anioCampus}).</CardTitle>
            <CardDescription>Pasto resaltada</CardDescription>
          </CardHeader>
          <CardContent>
            <GraficaBarras titulo="Matriculados por sede" unidad="matriculados" anchoEtiqueta={120} datos={r.campus.map((c) => ({ etiqueta: c.nombre, valor: c.total, destacado: c.nombre === "Pasto" }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>programas de la sede Pasto ({r.ultimo.anio}).</CardTitle>
          <CardDescription>Matriculados por programa y su cambio frente a {r.primero.anio} (— = el programa no tenía matriculados ese año)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
          <GraficaBarras titulo="Matriculados por programa" unidad="matriculados" datos={pregrado.map((p) => ({ etiqueta: p.programa, valor: p.total }))} />
          <Table>
            <THead>
              <TR>
                <TH>Programa</TH>
                <TH className="text-right">Mujeres</TH>
                <TH className="text-right">Hombres</TH>
                <TH className="text-right">vs. {r.primero.anio}</TH>
              </TR>
            </THead>
            <TBody>
              {[...pregrado, ...posgrado].map((p) => (
                <TR key={p.programa}>
                  <TD>
                    <span className="font-medium">{p.programa}</span>
                    <span className="block text-xs text-piedra">
                      {p.nivel} · {formatoNumero(p.total)} matriculados
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums">{formatoNumero(p.mujeres)}</TD>
                  <TD className="text-right tabular-nums">{formatoNumero(p.hombres)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{p.totalInicial ? pct((p.total - p.totalInicial) / p.totalInicial) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>programas activos en Pasto.</CardTitle>
          <CardDescription>Según el registro de programas del Ministerio de Educación</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Título que otorga</TH>
                <TH>Nivel</TH>
                <TH className="text-right">Créditos</TH>
                <TH className="text-right">Semestres</TH>
                <TH>Registro</TH>
              </TR>
            </THead>
            <TBody>
              {r.programasActivos.map((p) => (
                <TR key={p.titulo}>
                  <TD className="font-medium">{p.titulo}</TD>
                  <TD>{p.nivel}</TD>
                  <TD className="text-right tabular-nums">{p.creditos}</TD>
                  <TD className="text-right tabular-nums">{p.semestres}</TD>
                  <TD>{p.registro}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-petroleo" aria-hidden /> fuentes y depuración.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {Object.values(r.fuentes).map((f) => (
            <div key={f.id} className="space-y-1">
              <a href={f.url} target="_blank" rel="noreferrer" className="enlace inline-flex items-center gap-1 font-semibold text-tinta">
                {f.nombre} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              <p className="meta">
                {"// "}
                {f.publica} · actualizado el {f.actualizado} · {f.licencia}
              </p>
              <p>
                <span className="font-medium">Filtro:</span> {f.filtro}.
              </p>
              <p>
                <span className="font-medium">Depuración:</span> {f.depuracion}
              </p>
            </div>
          ))}
          <Alert variant={origen.tipo === "en-vivo" ? "info" : "warning"}>
            {r.nota}{" "}
            {origen.tipo === "en-vivo"
              ? `Cifras consultadas en vivo en datos.gov.co el ${formatoFechaHora(origen.consultadoEn)}.`
              : `datos.gov.co no respondió; se muestra el respaldo guardado en el repositorio, descargado el ${r.descargadoEn}.`}
          </Alert>
        </CardContent>
      </Card>
    </>
  );
}
