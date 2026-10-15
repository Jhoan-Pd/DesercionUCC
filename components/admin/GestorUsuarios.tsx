"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Lock, Pencil, Plus, Power, Unlock } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { enviarJson } from "@/lib/cliente-api";
import { ETIQUETA_ROL, ROLES, type Rol } from "@/lib/roles";

export interface UsuarioFila {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  estudianteCodigo: string | null;
  ultimoAcceso: string | null;
  bloqueado: boolean;
  minutosBloqueo: number;
}

type Modo = { tipo: "nuevo" } | { tipo: "editar"; u: UsuarioFila } | { tipo: "clave"; u: UsuarioFila };

/** Contraseña temporal legible que cumple la política (letras y números) */
function generarClave(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const valores = crypto.getRandomValues(new Uint32Array(10));
  const parte = Array.from(valores.slice(0, 6), (v) => letras[v % letras.length]).join("");
  const numeros = Array.from(valores.slice(6), (v) => String(v % 10)).join("");
  return `${parte.charAt(0).toUpperCase()}${parte.slice(1)}${numeros}`;
}

export function GestorUsuarios({ usuarios, usuarioActualId }: { usuarios: UsuarioFila[]; usuarioActualId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const [modo, setModo] = useState<Modo | null>(null);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("BIENESTAR");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [busqueda, setBusqueda] = useState(params.get("busqueda") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  function filtrar(clave: string, valor: string) {
    const q = new URLSearchParams(params.toString());
    if (valor) q.set(clave, valor);
    else q.delete(clave);
    q.delete("pagina");
    iniciar(() => router.push(`${pathname}?${q.toString()}`));
  }

  function abrir(m: Modo) {
    setError(null);
    setModo(m);
    if (m.tipo === "nuevo") {
      setEmail("");
      setNombre("");
      setRol("BIENESTAR");
      setCodigo("");
      setClave(generarClave());
    } else if (m.tipo === "editar") {
      setNombre(m.u.nombre);
      setRol(m.u.rol);
      setCodigo(m.u.estudianteCodigo ?? "");
    } else setClave(generarClave());
  }

  async function ejecutar(claveAccion: string, accion: () => Promise<unknown>, mensaje: string) {
    setOcupado(claveAccion);
    setError(null);
    try {
      await accion();
      setAviso(mensaje);
      setModo(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  }

  const pie = (texto: string, accion: () => void) => (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setModo(null)}>Cancelar</Button>
        <Button onClick={accion} disabled={ocupado !== null}>{ocupado === "dialogo" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{texto}</Button>
      </div>
    </div>
  );
  const campoClave = (
    <div className="space-y-1.5">
      <Label htmlFor="usr-clave">Contraseña temporal</Label>
      <div className="flex gap-2">
        <Input id="usr-clave" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="off" className="font-mono" />
        <Button type="button" variant="outline" onClick={() => setClave(generarClave())}>Generar</Button>
      </div>
      <p className="text-xs text-muted-foreground">Mínimo 8 caracteres con letras y números. Entrégala por un canal seguro; no se vuelve a mostrar.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <section aria-label="Filtros" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <Label htmlFor="f-rol" className="text-xs text-muted-foreground">Rol</Label>
          <Select id="f-rol" value={params.get("rol") ?? ""} onChange={(e) => filtrar("rol", e.target.value)}>
            <option value="">Todos</option>
            {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
          </Select>
        </div>
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <Label htmlFor="f-estado" className="text-xs text-muted-foreground">Estado</Label>
          <Select id="f-estado" value={params.get("estado") ?? ""} onChange={(e) => filtrar("estado", e.target.value)}>
            <option value="">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="bloqueados">Bloqueados</option>
          </Select>
        </div>
        <form className="min-w-[200px] flex-[2] space-y-1.5" onSubmit={(e) => { e.preventDefault(); filtrar("busqueda", busqueda.trim().length >= 2 ? busqueda.trim() : ""); }}>
          <Label htmlFor="f-busqueda" className="text-xs text-muted-foreground">Buscar por nombre o correo</Label>
          <Input id="f-busqueda" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escribe y presiona Enter" />
        </form>
        {pendiente && <Loader2 className="mb-3 h-4 w-4 animate-spin text-muted-foreground" aria-label="Cargando" />}
        <Button onClick={() => abrir({ tipo: "nuevo" })} className="shrink-0"><Plus className="h-4 w-4" aria-hidden /> Nueva cuenta</Button>
      </section>

      {aviso && !modo && <Alert variant="success">{aviso}</Alert>}
      {error && !modo && <Alert variant="error">{error}</Alert>}

      <Table>
        <THead><TR><TH>Nombre</TH><TH>Rol</TH><TH>Estado</TH><TH>Último acceso</TH><TH className="text-right">Acciones</TH></TR></THead>
        <TBody>
          {usuarios.length === 0 && (
            <TR><TD colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No hay cuentas con esos filtros.</TD></TR>
          )}
          {usuarios.map((u) => {
            const yo = u.id === usuarioActualId;
            return (
              <TR key={u.id} className={u.activo ? undefined : "opacity-60"}>
                <TD>
                  <p className="font-medium">{u.nombre}{yo && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}</p>
                  <p className="text-xs text-muted-foreground">{u.email}{u.estudianteCodigo && ` · ${u.estudianteCodigo}`}</p>
                </TD>
                <TD>{ETIQUETA_ROL[u.rol]}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {u.activo ? <Badge variant="success">Activa</Badge> : <Badge variant="muted">Inactiva</Badge>}
                    {u.bloqueado && <Badge variant="danger"><Lock className="mr-1 h-3 w-3" aria-hidden />Bloqueada {u.minutosBloqueo} min</Badge>}
                  </div>
                </TD>
                <TD className="whitespace-nowrap text-sm">{u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : <span className="text-muted-foreground">Nunca</span>}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => abrir({ tipo: "editar", u })} aria-label={`Editar ${u.email}`}><Pencil className="h-4 w-4" aria-hidden /></Button>
                    <Button variant="ghost" size="sm" onClick={() => abrir({ tipo: "clave", u })} aria-label={`Restablecer contraseña de ${u.email}`}><KeyRound className="h-4 w-4" aria-hidden /></Button>
                    {u.bloqueado && (
                      <Button variant="ghost" size="sm" disabled={ocupado !== null} onClick={() => ejecutar(`desb-${u.id}`, () => enviarJson(`/api/admin/usuarios/${u.id}`, "PATCH", { desbloquear: true }), `Cuenta ${u.email} desbloqueada.`)} aria-label={`Desbloquear ${u.email}`}>
                        <Unlock className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                    {!yo && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={ocupado !== null}
                        onClick={() => ejecutar(`act-${u.id}`, () => enviarJson(`/api/admin/usuarios/${u.id}`, "PATCH", { activo: !u.activo }), `Cuenta ${u.email} ${u.activo ? "desactivada: pierde el acceso de inmediato" : "activada"}.`)}
                        aria-label={`${u.activo ? "Desactivar" : "Activar"} ${u.email}`}
                      >
                        {ocupado === `act-${u.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Power className={`h-4 w-4 ${u.activo ? "text-destructive" : "text-green-700"}`} aria-hidden />}
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Dialog abierto={modo?.tipo === "nuevo"} onCerrar={() => setModo(null)} titulo="Nueva cuenta" descripcion="La persona ingresa con su correo y la contraseña temporal.">
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="usr-email">Correo institucional</Label><Input id="usr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ucc.edu.co" /></div>
          <div className="space-y-1.5"><Label htmlFor="usr-nombre">Nombre completo</Label><Input id="usr-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="usr-rol">Rol</Label>
            <Select id="usr-rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>{ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}</Select>
          </div>
          {rol === "ESTUDIANTE" && (
            <div className="space-y-1.5"><Label htmlFor="usr-codigo">Código del estudiante</Label><Input id="usr-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="UCC2024100123" /></div>
          )}
          {campoClave}
          {pie("Crear cuenta", () =>
            ejecutar("dialogo", () => enviarJson("/api/admin/usuarios", "POST", { email, nombre, rol, contrasena: clave, ...(rol === "ESTUDIANTE" ? { codigoEstudiante: codigo } : {}) }), `Cuenta ${email.trim().toLowerCase()} creada. Contraseña temporal: ${clave}`),
          )}
        </div>
      </Dialog>

      <Dialog abierto={modo?.tipo === "editar"} onCerrar={() => setModo(null)} titulo={modo?.tipo === "editar" ? `Editar ${modo.u.email}` : ""}>
        {modo?.tipo === "editar" && (
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="usr-nombre-e">Nombre completo</Label><Input id="usr-nombre-e" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="usr-rol-e">Rol</Label>
              <Select id="usr-rol-e" value={rol} onChange={(e) => setRol(e.target.value as Rol)} disabled={modo.u.id === usuarioActualId}>{ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}</Select>
              {modo.u.id === usuarioActualId && <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol.</p>}
            </div>
            {rol === "ESTUDIANTE" && (
              <div className="space-y-1.5"><Label htmlFor="usr-codigo-e">Código del estudiante</Label><Input id="usr-codigo-e" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
            )}
            {rol !== modo.u.rol && <Alert variant="info">El cambio de rol se aplica de inmediato, sin que la persona tenga que volver a iniciar sesión.</Alert>}
            {pie("Guardar", () =>
              ejecutar(
                "dialogo",
                () =>
                  enviarJson(`/api/admin/usuarios/${modo.u.id}`, "PATCH", {
                    nombre,
                    ...(rol !== modo.u.rol ? { rol } : {}),
                    ...(rol === "ESTUDIANTE" && codigo.trim().toUpperCase() !== (modo.u.estudianteCodigo ?? "") ? { codigoEstudiante: codigo } : {}),
                  }),
                `Cuenta ${modo.u.email} actualizada.`,
              ),
            )}
          </div>
        )}
      </Dialog>

      <Dialog abierto={modo?.tipo === "clave"} onCerrar={() => setModo(null)} titulo={modo?.tipo === "clave" ? `Restablecer contraseña de ${modo.u.email}` : ""} descripcion="También quita un bloqueo por intentos fallidos.">
        {modo?.tipo === "clave" && (
          <div className="space-y-3">
            {campoClave}
            {pie("Restablecer", () => ejecutar("dialogo", () => enviarJson(`/api/admin/usuarios/${modo.u.id}`, "PATCH", { contrasena: clave }), `Contraseña de ${modo.u.email} restablecida: ${clave}`))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
