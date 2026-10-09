-- Fase 3: periodo y alerta de origen de las intervenciones (para medir su efectividad),
-- bloqueo de cuentas por intentos fallidos, registro de importaciones CSV y auditoría
-- persistente de accesos a datos personales (Ley 1581 de 2012).
-- Equivalente a la salida de `prisma migrate diff` entre el esquema de la Fase 2 y el de la Fase 3.

-- AlterTable
ALTER TABLE "intervenciones" ADD COLUMN     "alertaId" TEXT,
ADD COLUMN     "periodoId" TEXT,
ADD COLUMN     "resultado" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "bloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "intentosFallidos" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "importaciones" (
    "id" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "filas" INTEGER NOT NULL,
    "estudiantesNuevos" INTEGER NOT NULL,
    "estudiantesActualizados" INTEGER NOT NULL,
    "semestres" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_accesos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "detalle" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_accesos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intervenciones_periodoId_idx" ON "intervenciones"("periodoId");

-- CreateIndex
CREATE INDEX "importaciones_creadaEn_idx" ON "importaciones"("creadaEn");

-- CreateIndex
CREATE INDEX "auditoria_accesos_creadoEn_idx" ON "auditoria_accesos"("creadoEn");

-- CreateIndex
CREATE INDEX "auditoria_accesos_usuarioId_idx" ON "auditoria_accesos"("usuarioId");

-- AddForeignKey
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alertas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_accesos" ADD CONSTRAINT "auditoria_accesos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
