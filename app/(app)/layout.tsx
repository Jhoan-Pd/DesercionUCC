import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { modulosParaRol } from "@/lib/modulos";
import { puedeAcceder } from "@/lib/rbac";
import { Sidebar } from "@/components/layout/Sidebar";

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
      <Sidebar modulos={modulosParaRol(rol)} usuario={{ nombre: name ?? "Usuario", email: email ?? "", rol }} />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
