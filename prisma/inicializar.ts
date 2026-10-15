/**
 * Inicialización de la base de datos durante el despliegue (Vercel ejecuta `npm run vercel-build`).
 *
 * Carga los datos de demostración SOLO si la base está vacía (sin usuarios). Así el primer
 * despliegue deja la aplicación lista para usar y los siguientes NO borran lo que se haya
 * registrado en producción (intervenciones, alertas, cambios de parámetros, importaciones...).
 *
 * Para recargar los datos a propósito: variable de entorno FORZAR_SEED=1 en un despliegue.
 */
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { urlParaPrisma } from "../lib/url-base-datos";

export function debeSembrar(usuarios: number, forzar: string | undefined): boolean {
  return usuarios === 0 || forzar === "1";
}

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: urlParaPrisma(process.env.DATABASE_URL) });
  let usuarios: number;
  try {
    usuarios = await prisma.usuario.count();
  } finally {
    await prisma.$disconnect();
  }

  if (!debeSembrar(usuarios, process.env.FORZAR_SEED)) {
    console.log(`ℹ️  La base de datos ya tiene ${usuarios} usuarios: no se cargan datos de demostración.`);
    return;
  }
  if (!process.env.SEED_DEMO_PASSWORD) {
    console.warn("⚠️  SEED_DEMO_PASSWORD no está definida: las cuentas demo usarán la contraseña de ejemplo del README. Cámbiala.");
  }
  console.log(usuarios === 0 ? "🌱 Base de datos vacía: cargando datos de demostración..." : "🌱 FORZAR_SEED=1: recargando datos de demostración...");
  const r = spawnSync("npx", ["prisma", "db", "seed"], { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error(`El seed terminó con código ${r.status}`);
}

if (process.argv[1] && process.argv[1].endsWith("inicializar.ts")) {
  main().catch((e) => {
    console.error("❌ No se pudo inicializar la base de datos:", e);
    process.exit(1);
  });
}
