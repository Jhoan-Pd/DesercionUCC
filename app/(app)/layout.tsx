import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { modulosParaRol } from "@/lib/modulos";
import { puedeAcceder } from "@/lib/rbac";
import { Navegacion } from "@/components/layout/Navegacion";

export const dynamic = "force-dynamic";

/** Layout de todas las páginas autenticadas: valida la sesión (revalidada contra la BD), el permiso de la ruta y arma el menú según el rol */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.revocada) redirect("/login?motivo=cuenta-desactivada");
  const { rol, name, email } = session.user;
  // Segunda verificación del permiso con el rol actual (el middleware usa el rol guardado en el token)
  const ruta = headers().get("x-ruta");
  if (ruta && !puedeAcceder(ruta, rol)) redirect("/acceso-denegado");

  return (
    <div className="min-h-screen">
      <Navegacion modulos={modulosParaRol(rol)} usuario={{ nombre: name ?? "Usuario", email: email ?? "", rol }} />
      <main className="mx-auto w-full max-w-[1200px] space-y-10 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">{children}</main>
      <footer className="mx-auto max-w-[1200px] px-4 pb-10 sm:px-6 lg:px-8">
        <p className="meta border-t pt-6">
          {"// "}Universidad Cooperativa de Colombia · sede Pasto · datos tratados conforme a la Ley 1581 de 2012
        </p>
      </footer>
    </div>
  );
}
