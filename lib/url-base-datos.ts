/**
 * Ajusta la cadena de conexión para Prisma cuando apunta a un *pooler* de PgBouncer
 * (Neon: host con "-pooler"; Supabase: puerto 6543).
 *
 * En modo transacción, PgBouncer reparte las consultas entre varias conexiones y Prisma puede
 * fallar con "prepared statement already exists". `pgbouncer=true` le indica a Prisma que no
 * reutilice sentencias preparadas. Así funciona tal cual la variable que inyecta la integración
 * Neon–Vercel, sin editarla a mano. Función pura: se prueba sin base de datos.
 */
export function urlParaPrisma(url: string | undefined): string | undefined {
  if (!url) return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url; // si no se puede interpretar, Prisma mostrará su propio error
  }
  const esPooler = u.hostname.includes("-pooler.") || u.port === "6543";
  if (!esPooler || u.searchParams.has("pgbouncer")) return url;
  u.searchParams.set("pgbouncer", "true");
  return u.toString();
}
