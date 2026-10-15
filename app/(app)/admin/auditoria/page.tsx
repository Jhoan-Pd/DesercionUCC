import { z } from "zod";
import { ServicioAuditoria } from "@/services/auditoria/ServicioAuditoria";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MigaAdmin } from "@/components/admin/MigaAdmin";
import { FiltroAccion } from "@/components/admin/FiltroAccion";
import { Paginacion } from "@/components/riesgo/Paginacion";

export const metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";

const ACCIONES: Record<string, string> = {
  CONSULTA_FICHA: "Consulta de ficha",
  CONSULTA_CALCULADORA: "Consulta en calculadora",
  EXPORTACION: "Exportación de reporte",
  IMPORTACION: "Importación CSV",
  INTERVENCION: "Intervención",
  LOGIN_BLOQUEADO: "Cuenta bloqueada",
  ADMIN_USUARIOS: "Gestión de usuarios",
  ADMIN_CATALOGOS: "Programas y periodos",
  ADMIN_MODELO: "Modelo de riesgo",
};

const filtrosSchema = z.object({
  accion: z.enum(Object.keys(ACCIONES) as [string, ...string[]]).optional(),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
});

export default async function AuditoriaPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const plano: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v !== "") plano[k] = v;
  const f = filtrosSchema.safeParse(plano);
  const filtros = f.success ? f.data : { pagina: 1 };
  const r = await new ServicioAuditoria().listar({ pagina: filtros.pagina, porPagina: 50, accion: "accion" in filtros ? filtros.accion : undefined });
  const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "medium", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <MigaAdmin actual="Auditoría" />
        <h1 className="text-2xl font-bold tracking-tight">Auditoría de accesos</h1>
        <p className="max-w-3xl text-muted-foreground">
          Registro de consultas a datos individuales, exportaciones, importaciones y cambios administrativos (Ley 1581 de 2012, principio de responsabilidad demostrada). Los estudiantes aparecen con su código anónimo.
        </p>
      </header>
      <FiltroAccion acciones={ACCIONES} />
      <Table>
        <THead><TR><TH>Fecha</TH><TH>Usuario</TH><TH>Acción</TH><TH>Recurso</TH><TH>Detalle</TH></TR></THead>
        <TBody>
          {r.filas.length === 0 && <TR><TD colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No hay registros.</TD></TR>}
          {r.filas.map((a) => (
            <TR key={a.id}>
              <TD className="whitespace-nowrap text-sm tabular-nums">{fecha.format(new Date(a.fecha))}</TD>
              <TD><p className="text-sm font-medium">{a.usuario}</p><p className="text-xs text-muted-foreground">{a.rol}</p></TD>
              <TD><Badge variant={a.accion === "LOGIN_BLOQUEADO" ? "danger" : a.accion.startsWith("ADMIN") ? "warning" : "default"}>{ACCIONES[a.accion] ?? a.accion}</Badge></TD>
              <TD className="font-mono text-xs">{a.recurso}</TD>
              <TD className="max-w-[320px] text-xs text-muted-foreground">{a.detalle}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Paginacion pagina={r.pagina} paginas={Math.max(1, Math.ceil(r.total / r.porPagina))} total={r.total} base="/admin/auditoria" params={plano} unidad="registros" />
    </div>
  );
}
