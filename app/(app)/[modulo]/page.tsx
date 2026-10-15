import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Construction } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { FASE_ACTUAL, MODULOS } from "@/lib/modulos";
import { Card, CardContent } from "@/components/ui/card";

/** Página "próximamente" para módulos de fases que aún no se han entregado (FASE_ACTUAL) */
export default async function ProximamentePage({ params }: { params: { modulo: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const modulo = MODULOS.find((m) => m.href === `/${params.modulo}` && m.fase > FASE_ACTUAL);
  if (!modulo) notFound();
  if (!modulo.roles.includes(session.user.rol)) redirect("/acceso-denegado");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{modulo.titulo}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <Construction className="h-10 w-10 text-ucc-amarillo" aria-hidden />
          <p className="text-lg font-semibold">Disponible en la Fase {modulo.fase}</p>
          <p className="max-w-md text-sm text-muted-foreground">{modulo.descripcion}</p>
        </CardContent>
      </Card>
    </div>
  );
}
