import Link from "next/link";
import { getServerSession } from "next-auth";
import { Search } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { filtrosEstudiantesSchema } from "@/lib/validators/estudiantes";
import { ServicioEstudiantes } from "@/services/estudiantes/ServicioEstudiantes";
import { Encabezado } from "@/components/comunes/Encabezado";
import { Paginacion } from "@/components/comunes/Paginacion";
import { Vacio } from "@/components/comunes/Vacio";
import { NivelBadge } from "@/components/estudiantes/NivelBadge";
import { BarraPuntaje } from "@/components/estudiantes/BarraPuntaje";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Estudiantes en riesgo" };
export const dynamic = "force-dynamic";

export default async function EstudiantesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const limpio = Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;
  const parsed = filtrosEstudiantesSchema.safeParse(limpio);
  const filtros = parsed.success ? parsed.data : {};
  const servicio = new ServicioEstudiantes();
  const [programas, lista] = await Promise.all([servicio.programas(), servicio.listar(filtros)]);
  const session = await getServerSession(authOptions);
  const hayFiltros = Boolean(filtros.q || filtros.programa || filtros.nivel);

  if (programas.length === 0) {
    return (
      <>
        <Encabezado titulo="Estudiantes en riesgo" />
        <Vacio
          titulo="Todavía no hay estudiantes cargados"
          accion={
            session?.user.rol === "ADMIN" ? (
              <Link href="/cargar" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-ucc-azul-oscuro">
                Cargar datos
              </Link>
            ) : null
          }
        >
          Cuando se cargue el archivo de estudiantes de la universidad, aquí aparecerán ordenados del mayor al menor riesgo.
        </Vacio>
      </>
    );
  }

  const params: Record<string, string> = {};
  if (filtros.q) params.q = filtros.q;
  if (filtros.programa) params.programa = filtros.programa;
  if (filtros.nivel) params.nivel = filtros.nivel;

  return (
    <>
      <Encabezado
        titulo="Estudiantes en riesgo"
        descripcion="Estudiantes activos ordenados del mayor al menor riesgo. Abre la ficha para ver los factores y la explicación del agente."
      />

      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto]" method="get">
            <label className="relative">
              <span className="sr-only">Buscar por nombre o código</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input name="q" defaultValue={filtros.q ?? ""} placeholder="Buscar por nombre o código" className="pl-9" />
            </label>
            <label>
              <span className="sr-only">Programa</span>
              <Select name="programa" defaultValue={filtros.programa ?? ""}>
                <option value="">Todos los programas</option>
                {programas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="sr-only">Nivel de riesgo</span>
              <Select name="nivel" defaultValue={filtros.nivel ?? ""}>
                <option value="">Todos los niveles</option>
                <option value="ALTO">Riesgo alto</option>
                <option value="MEDIO">Riesgo medio</option>
                <option value="BAJO">Riesgo bajo</option>
              </Select>
            </label>
            <div className="flex gap-2">
              <Button type="submit">Filtrar</Button>
              {hayFiltros && (
                <Link href="/estudiantes" className="inline-flex h-10 items-center rounded-md border px-3 text-sm hover:bg-secondary">
                  Limpiar
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {lista.total === 0 ? (
        <Vacio titulo="Ningún estudiante coincide con los filtros" />
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-5">
            {/* Móvil: tarjetas */}
            <ul className="divide-y md:hidden">
              {lista.filas.map((e) => (
                <li key={e.codigo} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/estudiantes/${encodeURIComponent(e.codigo)}`} className="font-medium text-primary hover:underline">
                        {e.nombre}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {e.codigo} · {e.programa} · sem. {e.semestre}
                      </p>
                    </div>
                    {e.nivel && e.puntaje !== null && (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <NivelBadge nivel={e.nivel} />
                        <span className="text-sm font-semibold tabular-nums">{e.puntaje}</span>
                      </div>
                    )}
                  </div>
                  {e.factores.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{e.factores.slice(0, 2).join(" · ")}</p>}
                </li>
              ))}
            </ul>
            {/* Escritorio: tabla */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Estudiante</TH>
                    <TH>Programa</TH>
                    <TH className="text-right">Sem.</TH>
                    <TH>Riesgo</TH>
                    <TH>Principales factores</TH>
                  </TR>
                </THead>
                <TBody>
                  {lista.filas.map((e) => (
                    <TR key={e.codigo}>
                      <TD>
                        <Link href={`/estudiantes/${encodeURIComponent(e.codigo)}`} className="font-medium text-primary hover:underline">
                          {e.nombre}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{e.codigo}</span>
                      </TD>
                      <TD>{e.programa}</TD>
                      <TD className="text-right tabular-nums">{e.semestre}</TD>
                      <TD>
                        {e.nivel && e.puntaje !== null ? (
                          <div className="flex flex-col gap-1">
                            <NivelBadge nivel={e.nivel} className="w-fit" />
                            <BarraPuntaje puntaje={e.puntaje} nivel={e.nivel} />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin evaluar</span>
                        )}
                      </TD>
                      <TD className="text-sm text-muted-foreground">{e.factores.length ? e.factores.slice(0, 2).join(" · ") : "Ninguno"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <Paginacion pagina={lista.pagina} paginas={lista.paginas} total={lista.total} base="/estudiantes" params={params} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
