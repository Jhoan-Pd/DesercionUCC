import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Construction } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { MODULOS } from "@/lib/modulos";
import { Card, CardContent } from "@/components/ui/card";

/** Páginas de módulos que se entregan en fases posteriores (2 y 3) */
export default async function ProximamentePage({ params }: { params: { modulo: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const modulo = MODULOS.find((m) => m.href === `/${params.modulo}` && m.fase > 1);
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
