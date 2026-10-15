import { describe, expect, it } from "vitest";
import { urlParaPrisma } from "@/lib/url-base-datos";

describe("urlParaPrisma", () => {
  it("agrega pgbouncer=true al pooler de Neon conservando los demás parámetros", () => {
    const url = "postgresql://usuario:clave@ep-calma-123-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
    const r = new URL(urlParaPrisma(url)!);
    expect(r.searchParams.get("pgbouncer")).toBe("true");
    expect(r.searchParams.get("sslmode")).toBe("require");
    expect(r.hostname).toBe("ep-calma-123-pooler.us-east-1.aws.neon.tech");
    expect(r.username).toBe("usuario");
  });

  it("agrega pgbouncer=true al pooler de transacciones de Supabase (puerto 6543)", () => {
    const r = urlParaPrisma("postgresql://postgres.abc:clave@aws-0-sa-east-1.pooler.supabase.com:6543/postgres");
    expect(new URL(r!).searchParams.get("pgbouncer")).toBe("true");
  });

  it("no toca conexiones directas ni las que ya traen pgbouncer", () => {
    const directa = "postgresql://usuario:clave@ep-calma-123.us-east-1.aws.neon.tech/neondb?sslmode=require";
    expect(urlParaPrisma(directa)).toBe(directa);
    const local = "postgresql://postgres:postgres@localhost:5432/observatorio?schema=public";
    expect(urlParaPrisma(local)).toBe(local);
    const yaTiene = "postgresql://u:c@x-pooler.neon.tech/db?pgbouncer=false";
    expect(urlParaPrisma(yaTiene)).toBe(yaTiene);
  });

  it("conserva contraseñas con caracteres codificados", () => {
    const r = urlParaPrisma("postgresql://u:p%40ss%2Fw0rd@ep-x-pooler.neon.tech/db");
    expect(r).toContain("p%40ss%2Fw0rd");
  });

  it("deja pasar valores vacíos o que no son URL", () => {
    expect(urlParaPrisma(undefined)).toBeUndefined();
    expect(urlParaPrisma("")).toBe("");
    expect(urlParaPrisma("no es una url")).toBe("no es una url");
  });
});
