import { ExternalLink, Landmark } from "lucide-react";
import { resumenUccPasto } from "@/lib/datos-abiertos";
import { Encabezado } from "@/components/comunes/Encabezado";
import { Indicador } from "@/components/comunes/Indicador";
import { GraficaBarras, GraficaColumnas } from "@/components/graficas/Graficas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Cifras oficiales UCC" };

const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);
const n = (v: number) => v.toLocaleString("es-CO");

/** Cifras oficiales y agregadas de la UCC (Ministerio de Educación, datos.gov.co). No hay datos individuales. */
export default function CifrasUccPage() {
  const r = resumenUccPasto();
  const pregrado = r.programas.filter((p) => p.nivel === "Pregrado");
  const posgrado = r.programas.filter((p) => p.nivel === "Posgrado");

  return (
    <>
      <Encabezado
        titulo="Cifras oficiales de la UCC Pasto"
        descripcion={
          <>
            Matrícula reportada por la universidad al Ministerio de Educación y publicada en datos.gov.co. Son cifras agregadas por programa, sexo y año; no contienen
            información de estudiantes individuales ni tasas de deserción.
          </>
        }
      />

      <div className="grid gap-4 [&>*]:min-w-0 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador etiqueta={`Matriculados en Pasto (${r.ultimo.anio})`} valor={n(r.ultimo.total)} nota={`${n(r.ultimo.pregrado)} en pregrado y ${n(r.ultimo.posgrado)} en posgrado`} />
        <Indicador etiqueta={`Cambio frente a ${r.primero.anio}`} valor={pct(r.variacionPasto)} nota={`${n(r.primero.total)} matriculados en ${r.primero.anio}`} />
        <Indicador etiqueta={`Cambio de toda la UCC (${r.nacional[0].anio}-${r.nacional[r.nacional.length - 1].anio})`} valor={pct(r.variacionNacional)} nota={`${n(r.nacional[r.nacional.length - 1].total)} matriculados en todas las sedes`} />
        <Indicador etiqueta={`Sede Pasto entre ${r.campus.length} sedes`} valor={`${r.posicionPasto}.ª`} nota={`por número de matriculados en ${r.anioCampus}`} />
      </div>

      <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Matriculados en la sede Pasto por año</CardTitle>
            <CardDescription>Primer semestre de cada año · todos los programas</CardDescription>
          </CardHeader>
          <CardContent>
            <GraficaColumnas titulo="Matriculados en la sede Pasto por año" unidad="matriculados" datos={r.porAnio.map((a) => ({ etiqueta: String(a.anio), valor: a.total }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriculados por sede de la UCC ({r.anioCampus})</CardTitle>
            <CardDescription>Pasto resaltada</CardDescription>
          </CardHeader>
          <CardContent>
            <GraficaBarras titulo="Matriculados por sede" unidad="matriculados" anchoEtiqueta={120} datos={r.campus.map((c) => ({ etiqueta: c.nombre, valor: c.total, destacado: c.nombre === "Pasto" }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Programas de la sede Pasto ({r.ultimo.anio})</CardTitle>
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
                    <span className="block text-xs text-muted-foreground">
                      {p.nivel} · {n(p.total)} matriculados
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums">{n(p.mujeres)}</TD>
                  <TD className="text-right tabular-nums">{n(p.hombres)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{p.totalInicial ? pct((p.total - p.totalInicial) / p.totalInicial) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Programas activos en Pasto</CardTitle>
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
            <Landmark className="h-4 w-4" aria-hidden /> Fuentes y depuración
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {Object.values(r.fuentes).map((f) => (
            <div key={f.id} className="space-y-1">
              <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                {f.nombre} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              <p className="text-muted-foreground">
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
          <Alert variant="info">
            {r.nota} Datos descargados el {r.descargadoEn}; se actualizan con <code className="rounded bg-secondary px-1">npm run datos:actualizar</code>.
          </Alert>
        </CardContent>
      </Card>
    </>
  );
}
