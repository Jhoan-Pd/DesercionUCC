import type { DefaultSession } from "next-auth";
import type { Rol } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    /** true si, después de iniciar sesión, la cuenta se desactivó, se eliminó o cambió su contraseña */
    revocada?: boolean;
    user: {
      id: string;
      rol: Rol;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    rol: Rol;
    /** Huella de la contraseña con la que se inició sesión */
    huella: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    rol: Rol;
    huella?: string;
    revocada?: boolean;
  }
}
