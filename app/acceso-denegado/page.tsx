import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = { title: "Acceso denegado" };

export default function AccesoDenegado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="h-12 w-12 text-destructive" aria-hidden />
      <h1 className="text-2xl font-bold">Acceso denegado</h1>
      <p className="max-w-md text-muted-foreground">
        Tu rol no tiene permiso para ver esta sección. Los datos individuales de estudiantes están protegidos por la Ley 1581 de 2012 (habeas data).
      </p>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-ucc-azul-oscuro">
        Volver a mi inicio
      </Link>
    </main>
  );
}
