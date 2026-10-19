import Link from "next/link";
import { getServerSession } from "next-auth";
import { AlertOctagon, AlertTriangle, Bot, CheckCircle2, Upload, Users } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { ServicioEstudiantes } from "@/services/estudiantes/ServicioEstudiantes";
import { Encabezado } from "@/components/comunes/Encabezado";
import { Indicador } from "@/components/comunes/Indicador";
import { Vacio } from "@/components/comunes/Vacio";
import { MetodoRiesgo } from "@/components/estudiantes/MetodoRiesgo";
import { BarraNiveles, LeyendaNiveles } from "@/components/estudiantes/BarraNiveles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Inicio" };
export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("es-CO");
const pct = (v: number, total: number) => (total > 0 ? `${Math.round((v / total) * 100)} % de los activos` : "");
const boton = "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium";

export default async function InicioPage() {
  const session = await getServerSession(authOptions);
  const esAdmin = session?.user.rol === "ADMIN";
  const r = await new ServicioEstudiantes().resumen();

  if (r.activos === 0) {
    return (
      <>
        <Encabezado titulo="Inicio" descripcion="Resumen del riesgo de deserción de los estudiantes de la UCC sede Pasto." />
        <Vacio
          titulo="Todavía no hay estudiantes cargados"
          accion={
            esAdmin ? (
              <Link href="/cargar" className={`${boton} bg-primary text-primary-foreground hover:bg-ucc-azul-oscuro`}>
                <Upload className="h-4 w-4" aria-hidden /> Cargar el archivo de estudiantes
              </Link>
            ) : null
          }
        >
          {esAdmin
            ? "El sistema solo trabaja con datos reales de la universidad. Sube el archivo de estudiantes (Excel o CSV) para calcular el riesgo de cada uno."
            : "El sistema solo trabaja con datos reales de la universidad. Cuando el administrador cargue el archivo de estudiantes, aquí verás el resumen del riesgo."}
          <p className="mt-2">
            Mientras tanto puedes consultar las{" "}
            <Link href="/cifras-ucc" className="font-medium text-primary hover:underline">
              cifras oficiales de la UCC Pasto
            </Link>
            .
          </p>
        </Vacio>
      </>
    );
  }

  return (
    <>
      <Encabezado titulo="Inicio" descripcion="Resumen del riesgo de deserción de los estudiantes activos cargados.">
        <Link href="/estudiantes?nivel=ALTO" className={`${boton} bg-primary text-primary-foreground hover:bg-ucc-azul-oscuro`}>
          Ver riesgo alto
        </Link>
        <Link href="/agente" className={`${boton} border bg-card hover:bg-secondary`}>
          <Bot className="h-4 w-4" aria-hidden /> Preguntar al agente
        </Link>
      </Encabezado>

      <div className="grid gap-4 [&>*]:min-w-0 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador etiqueta="Estudiantes activos" valor={n(r.activos)} icono={<Users className="h-4 w-4" aria-hidden />} nota={r.ultimaCarga ? `Última carga: ${new Date(r.ultimaCarga.fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}` : undefined} />
        <Indicador etiqueta="Riesgo alto" valor={n(r.nivel.ALTO)} nota={pct(r.nivel.ALTO, r.activos)} icono={<AlertOctagon className="h-4 w-4 text-red-700" aria-hidden />} />
        <Indicador etiqueta="Riesgo medio" valor={n(r.nivel.MEDIO)} nota={pct(r.nivel.MEDIO, r.activos)} icono={<AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden />} />
        <Indicador etiqueta="Riesgo bajo" valor={n(r.nivel.BAJO)} nota={pct(r.nivel.BAJO, r.activos)} icono={<CheckCircle2 className="h-4 w-4 text-green-700" aria-hidden />} />
      </div>

      <MetodoRiesgo modelo={r.modelo} />

      <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Riesgo por programa</CardTitle>
            <CardDescription>Ordenado por número de estudiantes en riesgo alto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LeyendaNiveles />
            <Table>
              <THead>
                <TR>
                  <TH>Programa</TH>
                  <TH className="w-2/5">Distribución</TH>
                  <TH className="text-right">Alto</TH>
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {r.programas.map((p) => (
                  <TR key={p.programa}>
                    <TD>
                      <Link href={`/estudiantes?programa=${encodeURIComponent(p.programa)}`} className="font-medium hover:underline">
                        {p.programa}
                      </Link>
                    </TD>
                    <TD>
                      <BarraNiveles alto={p.ALTO} medio={p.MEDIO} bajo={p.BAJO} />
                    </TD>
                    <TD className="text-right tabular-nums">{n(p.ALTO)}</TD>
                    <TD className="text-right tabular-nums">{n(p.total)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Factores más frecuentes</CardTitle>
            <CardDescription>Entre los estudiantes con riesgo medio o alto</CardDescription>
          </CardHeader>
          <CardContent>
            {r.factores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún estudiante tiene riesgo medio o alto.</p>
            ) : (
              <ul className="space-y-3">
                {r.factores.map((f) => {
                  const max = r.factores[0].n;
                  return (
                    <li key={f.etiqueta} className="space-y-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span>{f.etiqueta}</span>
                        <span className="tabular-nums text-muted-foreground">{n(f.n)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary" role="presentation">
                        <div className="h-2 rounded-full bg-ucc-azul" style={{ width: `${(f.n / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
