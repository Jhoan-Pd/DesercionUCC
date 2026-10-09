/**
 * Exporta el panel estudiante-semestre a CSV para entrenar el modelo en Python.
 * Uso:  npm run ml:dataset      (lee la BD configurada en .env)
 *
 * Las columnas de características ya vienen calculadas con el MISMO código que usa la app
 * (services/riesgo/caracteristicas.ts), así Python y TypeScript ven exactamente el mismo vector.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { clavesCaracteristicas, construirPanel, programaMasFrecuente, vectorizar } from "../services/riesgo/caracteristicas";
import { cargarRegistros } from "../services/riesgo/registros";

export async function exportarDataset(prisma: PrismaClient, destino: string): Promise<{ filas: number; positivos: number; caracteristicas: string[] }> {
  const registros = await cargarRegistros(prisma);
  const referencia = programaMasFrecuente(registros);
  const claves = clavesCaracteristicas(registros.map((r) => r.programa), referencia);
  const panel = construirPanel(registros);

  const escapar = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lineas = [["estudiante_id", "semestre_fila", "y", ...claves].map(escapar).join(",")];
  for (const f of panel) lineas.push([f.estudianteId, f.semestre, f.y, ...vectorizar(f.datos, claves).map((v) => Math.round(v * 1e6) / 1e6)].join(","));

  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, lineas.join("\n") + "\n", "utf8");
  return { filas: panel.length, positivos: panel.filter((f) => f.y === 1).length, caracteristicas: claves };
}

if (process.argv[1] && process.argv[1].endsWith("exportar_dataset.ts")) {
  const prisma = new PrismaClient();
  const destino = join(process.cwd(), "ml", "datos", "panel_entrenamiento.csv");
  exportarDataset(prisma, destino)
    .then((r) => {
      console.log(`✅ ${r.filas} filas (${r.positivos} positivos, tasa base ${((100 * r.positivos) / r.filas).toFixed(2)}%) -> ${destino}`);
      console.log(`   ${r.caracteristicas.length} características: ${r.caracteristicas.join(", ")}`);
    })
    .catch((e) => {
      console.error("❌", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
