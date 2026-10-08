import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { modulosParaRol } from "@/lib/modulos";
import { Sidebar } from "@/components/layout/Sidebar";

export const dynamic = "force-dynamic";

/** Layout de todas las páginas autenticadas: valida sesión y arma el menú según el rol */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { rol, name, email } = session.user;

  return (
    <div className="min-h-screen">
      <Sidebar modulos={modulosParaRol(rol)} usuario={{ nombre: name ?? "Usuario", email: email ?? "", rol }} />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
