import Link from "next/link";
import { CalendarRange, ChevronRight, ClipboardList, FileUp, GraduationCap, Settings2, ShieldCheck, Users, Brain } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SECCIONES_ADMIN, type SeccionAdmin } from "@/lib/admin-secciones";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Administración" };
export const dynamic = "force-dynamic";

const ICONOS: Record<SeccionAdmin["icono"], React.ReactNode> = {
  parametros: <Settings2 className="h-5 w-5" aria-hidden />,
  programas: <GraduationCap className="h-5 w-5" aria-hidden />,
  periodos: <CalendarRange className="h-5 w-5" aria-hidden />,
  importar: <FileUp className="h-5 w-5" aria-hidden />,
  usuarios: <Users className="h-5 w-5" aria-hidden />,
  modelo: <Brain className="h-5 w-5" aria-hidden />,
  auditoria: <ShieldCheck className="h-5 w-5" aria-hidden />,
};

export default async function AdminPage() {
  const [programas, periodo, estudiantes, usuarios, importaciones] = await Promise.all([
    prisma.programa.count({ where: { activo: true } }),
    prisma.periodo.findFirst({ where: { activo: true }, select: { codigo: true } }),
    prisma.estudiante.count(),
    prisma.usuario.count({ where: { activo: true } }),
    prisma.importacion.count(),
  ]);
  const resumen = [
    { etiqueta: "Periodo actual", valor: periodo?.codigo ?? "Ninguno" },
    { etiqueta: "Programas activos", valor: programas.toLocaleString("es-CO") },
    { etiqueta: "Estudiantes registrados", valor: estudiantes.toLocaleString("es-CO") },
    { etiqueta: "Usuarios activos", valor: usuarios.toLocaleString("es-CO") },
    { etiqueta: "Importaciones CSV", valor: importaciones.toLocaleString("es-CO") },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Administración</h1>
        <p className="max-w-3xl text-muted-foreground">Configuración del observatorio. Todos los cambios quedan registrados en la auditoría.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {resumen.map((r) => (
          <div key={r.etiqueta} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{r.etiqueta}</p>
            <p className="text-xl font-bold tabular-nums">{r.valor}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECCIONES_ADMIN.map((s) => (
          <Link key={s.href} href={s.href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-primary/5">
              <CardContent className="flex items-start gap-4 p-5">
                <span className="rounded-lg bg-secondary p-2.5 text-primary">{ICONOS[s.icono]}</span>
                <div className="flex-1 space-y-1">
                  <p className="font-semibold">{s.titulo}</p>
                  <p className="text-sm text-muted-foreground">{s.descripcion}</p>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Las acciones administrativas solo están disponibles para el rol Administrador.
      </p>
    </div>
  );
}
