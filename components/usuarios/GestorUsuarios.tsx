"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, UserPlus } from "lucide-react";
import { enviarJson } from "@/lib/cliente-api";
import { ETIQUETA_ROL, type Rol } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export interface UsuarioFila {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  bloqueado: boolean;
  ultimoAcceso: string | null;
}

export function GestorUsuarios({ usuarios, actualId }: { usuarios: UsuarioFila[]; actualId: string }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [nuevo, setNuevo] = useState({ nombre: "", email: "", rol: "BIENESTAR" as Rol, password: "" });
  const [clave, setClave] = useState<{ id: string; valor: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(accion: () => Promise<unknown>, exito: string) {
    setOcupado(true);
    setMensaje(null);
    try {
      await accion();
      setMensaje({ tipo: "success", texto: exito });
      router.refresh();
      return true;
    } catch (e) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar." });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const actualizar = (id: string, cambio: Record<string, unknown>, exito: string) => ejecutar(() => enviarJson(`/api/usuarios/${id}`, "PATCH", cambio), exito);

  return (
    <div className="space-y-6">
      {mensaje && <Alert variant={mensaje.tipo}>{mensaje.texto}</Alert>}

      <form
        className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-2 xl:grid-cols-[2fr_2fr_1.5fr_2fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await ejecutar(() => enviarJson("/api/usuarios", "POST", nuevo), `Cuenta creada para ${nuevo.email}. Comparte la contraseña por un canal seguro.`);
          if (ok) setNuevo({ nombre: "", email: "", rol: "BIENESTAR", password: "" });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" required minLength={3} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo institucional</Label>
          <Input id="email" type="email" required value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rol">Rol</Label>
          <Select id="rol" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>
            <option value="BIENESTAR">{ETIQUETA_ROL.BIENESTAR}</option>
            <option value="ADMIN">{ETIQUETA_ROL.ADMIN}</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña inicial</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, con letras y números.</p>
        </div>
        <div className="flex items-start pt-6">
          <Button type="submit" disabled={ocupado}>
            <UserPlus className="h-4 w-4" aria-hidden /> Crear cuenta
          </Button>
        </div>
      </form>

      <div className="rounded-xl border bg-card px-3 py-2">
        <Table>
        <THead>
          <TR>
            <TH>Usuario</TH>
            <TH>Rol</TH>
            <TH>Estado</TH>
            <TH>Último acceso</TH>
            <TH>Acciones</TH>
          </TR>
        </THead>
        <TBody>
          {usuarios.map((u) => {
            const soyYo = u.id === actualId;
            return (
              <TR key={u.id}>
                <TD>
                  <span className="font-medium">{u.nombre}</span>
                  {soyYo && <span className="ml-1 text-xs text-muted-foreground">(tú)</span>}
                  <span className="block font-mono text-[11px] text-piedra">{u.email}</span>
                </TD>
                <TD>
                  <Select
                    aria-label={`Rol de ${u.nombre}`}
                    value={u.rol}
                    disabled={soyYo || ocupado}
                    onChange={(e) => actualizar(u.id, { rol: e.target.value }, `Rol de ${u.nombre} actualizado.`)}
                    className="h-9 w-auto"
                  >
                    <option value="BIENESTAR">{ETIQUETA_ROL.BIENESTAR}</option>
                    <option value="ADMIN">{ETIQUETA_ROL.ADMIN}</option>
                  </Select>
                </TD>
                <TD className="space-x-1">
                  <Badge variant={u.activo ? "success" : "muted"}>{u.activo ? "Activa" : "Inactiva"}</Badge>
                  {u.bloqueado && (
                    <Badge variant="danger">
                      <Lock className="mr-1 h-3 w-3" aria-hidden /> Bloqueada
                    </Badge>
                  )}
                </TD>
                <TD className="font-mono text-xs text-piedra">{u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }) : "Nunca"}</TD>
                <TD>
                  <div className="flex flex-wrap gap-2">
                    {!soyYo && (
                      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => actualizar(u.id, { activo: !u.activo }, u.activo ? `Cuenta de ${u.nombre} desactivada.` : `Cuenta de ${u.nombre} activada.`)}>
                        {u.activo ? "Desactivar" : "Activar"}
                      </Button>
                    )}
                    {u.bloqueado && (
                      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => actualizar(u.id, { desbloquear: true }, `Cuenta de ${u.nombre} desbloqueada.`)}>
                        Desbloquear
                      </Button>
                    )}
                    {clave?.id === u.id ? (
                      <form
                        className="flex gap-1"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (await actualizar(u.id, { password: clave.valor }, `Contraseña de ${u.nombre} cambiada.`)) setClave(null);
                        }}
                      >
                        <Input type="password" autoComplete="new-password" aria-label="Nueva contraseña" placeholder="Nueva contraseña" className="h-8 w-40" value={clave.valor} onChange={(e) => setClave({ id: u.id, valor: e.target.value })} />
                        <Button size="sm" type="submit" disabled={ocupado || clave.valor.length < 8}>
                          Guardar
                        </Button>
                        <Button size="sm" type="button" variant="ghost" onClick={() => setClave(null)}>
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setClave({ id: u.id, valor: "" })}>
                        <KeyRound className="h-3.5 w-3.5" aria-hidden /> Contraseña
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
        </Table>
      </div>
    </div>
  );
}
