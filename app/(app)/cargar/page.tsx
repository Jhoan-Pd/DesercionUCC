import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { COLUMNAS } from "@/services/carga/lector";
import { ServicioCarga } from "@/services/carga/ServicioCarga";
import { Encabezado } from "@/components/comunes/Encabezado";
import { CargaArchivo } from "@/components/carga/CargaArchivo";
import { BorrarDatos } from "@/components/carga/BorrarDatos";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Cargar datos" };
export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("es-CO");

export default async function CargarPage() {
  const [historial, total] = await Promise.all([new ServicioCarga().historial(), prisma.estudiante.count()]);
  const enlace = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <>
      <Encabezado
        seccion="/cargar"
        titulo="datos reales, nunca inventados."
        descripcion="Sube el archivo real de la universidad (Registro Académico o Bienestar). Si un código ya existe, se actualiza. Después de cada carga se recalcula el riesgo de todos los estudiantes activos."
      >
        <a href="/api/cargas/plantilla" className={enlace}>
          <Download className="h-4 w-4" aria-hidden /> Plantilla Excel
        </a>
        <a href="/api/cargas/plantilla?formato=csv" className={enlace}>
          <Download className="h-4 w-4" aria-hidden /> Plantilla CSV
        </a>
      </Encabezado>

      <div className="grid items-start gap-5 [&>*]:min-w-0 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>subir archivo.</CardTitle>
            <CardDescription>Actualmente hay {n(total)} estudiantes cargados.</CardDescription>
          </CardHeader>
          <CardContent>
            <CargaArchivo />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>columnas del archivo.</CardTitle>
            <CardDescription>Solo las 4 primeras son obligatorias. Lo que no venga no se usa para el riesgo (nunca se inventa).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {COLUMNAS.map((c) => (
                <li key={c.campo} className="py-2">
                  <code className="rounded-sm bg-bruma px-1.5 py-0.5 font-mono text-xs text-marino">{c.alias[0]}</code>
                  {c.obligatoria && <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-riesgo-alto">obligatoria</span>}
                  <p className="mt-1 text-grafito">{c.descripcion}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Para que el sistema pueda entrenar un modelo propio de la UCC, incluye también estudiantes que ya se retiraron o se graduaron (columna <code>estado</code>).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>historial de cargas.</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="meta">{"// todavía no se ha cargado ningún archivo"}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Archivo</TH>
                  <TH>Por</TH>
                  <TH className="text-right">Nuevos</TH>
                  <TH className="text-right">Actualizados</TH>
                  <TH className="text-right">Con error</TH>
                </TR>
              </THead>
              <TBody>
                {historial.map((c) => (
                  <TR key={c.id}>
                    <TD className="whitespace-nowrap font-mono text-xs">{new Date(c.creadaEn).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })}</TD>
                    <TD className="max-w-[240px] truncate">{c.archivo}</TD>
                    <TD>{c.usuario}</TD>
                    <TD className="text-right tabular-nums">{n(c.nuevos)}</TD>
                    <TD className="text-right tabular-nums">{n(c.actualizados)}</TD>
                    <TD className="text-right tabular-nums">{n(c.errores)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>empezar de cero.</CardTitle>
          <CardDescription>Útil si se cargó un archivo equivocado.</CardDescription>
        </CardHeader>
        <CardContent>
          <BorrarDatos total={total} />
        </CardContent>
      </Card>
    </>
  );
}
