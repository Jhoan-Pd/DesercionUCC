-- Fase 2: cursos del periodo (panel docente), inscripciones, versiones del modelo de riesgo,
-- consentimiento de contacto y puntajes por dimensión en la encuesta, y curso de origen de las alertas.
-- Equivalente a la salida de `prisma migrate diff` entre el esquema de la Fase 1 y el de la Fase 2.

-- AlterTable
ALTER TABLE "alertas" ADD COLUMN     "cursoId" TEXT;

-- AlterTable
ALTER TABLE "encuestas" ADD COLUMN     "autorizaContacto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "puntajesDimension" JSONB;

-- CreateTable
CREATE TABLE "cursos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,
    "creditos" INTEGER NOT NULL DEFAULT 3,
    "programaId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "notaParcial" DOUBLE PRECISION,
    "asistenciaPct" DOUBLE PRECISION NOT NULL,
    "fallas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos_riesgo" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "definicion" JSONB NOT NULL,
    "metricas" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entrenadoPorId" TEXT,

    CONSTRAINT "modelos_riesgo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cursos_docenteId_idx" ON "cursos"("docenteId");

-- CreateIndex
CREATE INDEX "cursos_periodoId_idx" ON "cursos"("periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_codigo_periodoId_key" ON "cursos"("codigo", "periodoId");

-- CreateIndex
CREATE INDEX "inscripciones_estudianteId_idx" ON "inscripciones"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_cursoId_estudianteId_key" ON "inscripciones"("cursoId", "estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_riesgo_version_key" ON "modelos_riesgo"("version");

-- CreateIndex
CREATE INDEX "modelos_riesgo_activo_idx" ON "modelos_riesgo"("activo");

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_riesgo" ADD CONSTRAINT "modelos_riesgo_entrenadoPorId_fkey" FOREIGN KEY ("entrenadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
