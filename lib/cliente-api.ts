/**
 * Llamadas a la API desde componentes de cliente. Si la respuesta no es exitosa lanza un Error con
 * el mensaje de la API y los detalles de validación de Zod ("campo: mensaje"), listo para mostrar.
 */
export async function enviarJson<T = unknown>(url: string, metodo: "POST" | "PATCH" | "PUT" | "DELETE", cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalles = Array.isArray(datos.detalles)
      ? datos.detalles.map((d: { campo?: string; mensaje?: string }) => (d.mensaje ? d.mensaje : String(d))).join(" · ")
      : "";
    throw new Error([datos.error ?? "Ocurrió un error inesperado.", detalles].filter(Boolean).join(" — "));
  }
  return datos as T;
}
