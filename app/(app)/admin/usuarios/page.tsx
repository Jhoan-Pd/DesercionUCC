import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ETIQUETA_ROL, ROLES } from "@/lib/roles";
import { filtrosUsuariosSchema } from "@/lib/validators/admin";
import { ServicioUsuarios } from "@/services/admin/ServicioUsuarios";
import { Alert } from "@/components/ui/alert";
import { GestorUsuarios } from "@/components/admin/GestorUsuarios";
import { MigaAdmin } from "@/components/admin/MigaAdmin";
import { Paginacion } from "@/components/riesgo/Paginacion";

export const metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

export default async function UsuariosPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = (await getServerSession(authOptions))!;
  const plano: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v !== "") plano[k] = v;
  const filtros = filtrosUsuariosSchema.safeParse(plano);
  const lista = await new ServicioUsuarios().listar(filtros.success ? filtros.data : filtrosUsuariosSchema.parse({}));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <MigaAdmin actual="Usuarios" />
        <h1 className="text-2xl font-bold tracking-tight">Usuarios y roles</h1>
        <p className="max-w-3xl text-muted-foreground">
          Cuentas activas: {ROLES.map((r) => `${lista.activosPorRol[r] ?? 0} ${ETIQUETA_ROL[r].toLowerCase()}`).join(" · ")}. Desactivar una cuenta le quita el acceso de inmediato.
        </p>
      </header>
      {!filtros.success && <Alert variant="warning">Algún filtro de la URL no era válido y se ignoró.</Alert>}
      <GestorUsuarios usuarios={lista.filas} usuarioActualId={session.user.id} />
      <Paginacion pagina={lista.pagina} paginas={lista.paginas} total={lista.total} base="/admin/usuarios" params={plano} unidad="cuentas" />
    </div>
  );
}
