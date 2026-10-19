-- Simplificación (v0.4): se eliminan TODAS las tablas con datos simulados de las fases 1-3
-- y se crea el esquema reducido de dos roles con estudiantes cargados desde archivos reales.
-- Ojo: esta migración borra los datos existentes (eran de demostración).

-- 1. Tablas anteriores
DROP TABLE IF EXISTS "auditoria_accesos" CASCADE;
DROP TABLE IF EXISTS "importaciones" CASCADE;
DROP TABLE IF EXISTS "inscripciones" CASCADE;
DROP TABLE IF EXISTS "cursos" CASCADE;
DROP TABLE IF EXISTS "intervenciones" CASCADE;
DROP TABLE IF EXISTS "alertas" CASCADE;
DROP TABLE IF EXISTS "puntajes_riesgo" CASCADE;
DROP TABLE IF EXISTS "respuestas_encuesta" CASCADE;
DROP TABLE IF EXISTS "encuestas" CASCADE;
DROP TABLE IF EXISTS "retiros" CASCADE;
DROP TABLE IF EXISTS "causas_desercion" CASCADE;
DROP TABLE IF EXISTS "financiacion" CASCADE;
DROP TABLE IF EXISTS "notas_semestre" CASCADE;
DROP TABLE IF EXISTS "matriculas" CASCADE;
DROP TABLE IF EXISTS "parametros_economicos" CASCADE;
DROP TABLE IF EXISTS "modelos_riesgo" CASCADE;
DROP TABLE IF EXISTS "estudiantes" CASCADE;
DROP TABLE IF EXISTS "periodos" CASCADE;
DROP TABLE IF EXISTS "programas" CASCADE;
DROP TABLE IF EXISTS "usuarios" CASCADE;
DROP TABLE IF EXISTS "roles" CASCADE;

-- 2. Tipos anteriores
DROP TYPE IF EXISTS "CategoriaCausa";
DROP TYPE IF EXISTS "CategoriaParametro";
DROP TYPE IF EXISTS "DimensionEncuesta";
DROP TYPE IF EXISTS "EstadoAlerta";
DROP TYPE IF EXISTS "EstadoEstudiante";
DROP TYPE IF EXISTS "EstadoIntervencion";
DROP TYPE IF EXISTS "NivelRiesgo";
DROP TYPE IF EXISTS "OrigenAlerta";
DROP TYPE IF EXISTS "Sexo";
DROP TYPE IF EXISTS "TipoFinanciacion";
DROP TYPE IF EXISTS "TipoIntervencion";

-- 3. Esquema nuevo
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'BIENESTAR');
CREATE TYPE "EstadoEstudiante" AS ENUM ('ACTIVO', 'RETIRADO', 'GRADUADO');
CREATE TYPE "NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cargas" (
    "id" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "filas" INTEGER NOT NULL,
    "nuevos" INTEGER NOT NULL,
    "actualizados" INTEGER NOT NULL,
    "errores" JSONB NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "estudiantes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "programa" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,
    "promedio" DOUBLE PRECISION,
    "materiasPerdidas" INTEGER,
    "asistencia" DOUBLE PRECISION,
    "estrato" INTEGER,
    "trabaja" BOOLEAN,
    "apoyoFinanciero" BOOLEAN,
    "moraMatricula" BOOLEAN,
    "puntajeSaber11" INTEGER,
    "edad" INTEGER,
    "estado" "EstadoEstudiante" NOT NULL DEFAULT 'ACTIVO',
    "periodo" TEXT,
    "cargaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluaciones" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "nivel" "NivelRiesgo" NOT NULL,
    "metodo" TEXT NOT NULL,
    "modeloVersion" TEXT,
    "factores" JSONB NOT NULL,
    "faltantes" TEXT[],
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "explicacion" TEXT,
    "explicadaEn" TIMESTAMP(3),
    "modeloIa" TEXT,

    CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "modelos_riesgo" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "definicion" JSONB NOT NULL,
    "metricas" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modelos_riesgo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE INDEX "cargas_creadaEn_idx" ON "cargas"("creadaEn");
CREATE UNIQUE INDEX "estudiantes_codigo_key" ON "estudiantes"("codigo");
CREATE INDEX "estudiantes_programa_idx" ON "estudiantes"("programa");
CREATE INDEX "estudiantes_estado_idx" ON "estudiantes"("estado");
CREATE UNIQUE INDEX "evaluaciones_estudianteId_key" ON "evaluaciones"("estudianteId");
CREATE INDEX "evaluaciones_nivel_idx" ON "evaluaciones"("nivel");
CREATE UNIQUE INDEX "modelos_riesgo_version_key" ON "modelos_riesgo"("version");
CREATE INDEX "modelos_riesgo_activo_idx" ON "modelos_riesgo"("activo");

ALTER TABLE "cargas" ADD CONSTRAINT "cargas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "cargas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evaluaciones" ADD CONSTRAINT "evaluaciones_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
