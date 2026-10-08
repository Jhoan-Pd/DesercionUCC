-- Migración inicial del Observatorio de Deserción UCC (16 tablas + enums).
-- Equivalente a: prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- (estructura verificada contra el esquema: columnas, tipos, restricciones, índices y enums).


-- CreateEnum
CREATE TYPE "EstadoEstudiante" AS ENUM ('ACTIVO', 'GRADUADO', 'DESERTOR', 'APLAZADO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('F', 'M', 'O');

-- CreateEnum
CREATE TYPE "TipoFinanciacion" AS ENUM ('RECURSOS_PROPIOS', 'ICETEX', 'BECA', 'CREDITO_UCC');

-- CreateEnum
CREATE TYPE "CategoriaCausa" AS ENUM ('INDIVIDUAL', 'ACADEMICA', 'SOCIOECONOMICA', 'INSTITUCIONAL');

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('ABIERTA', 'EN_SEGUIMIENTO', 'CERRADA');

-- CreateEnum
CREATE TYPE "OrigenAlerta" AS ENUM ('DOCENTE', 'MODELO', 'ENCUESTA', 'BIENESTAR');

-- CreateEnum
CREATE TYPE "TipoIntervencion" AS ENUM ('TUTORIA', 'APOYO_ECONOMICO', 'ACOMPANAMIENTO_PSICOLOGICO', 'ORIENTACION_VOCACIONAL', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoIntervencion" AS ENUM ('EN_CURSO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DimensionEncuesta" AS ENUM ('ECONOMICA', 'ACADEMICA', 'MOTIVACION', 'ENTORNO');

-- CreateEnum
CREATE TYPE "CategoriaParametro" AS ENUM ('SALARIO', 'COSTO', 'FINANCIERO', 'ESCENARIO', 'SPADIES');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "rolId" INTEGER NOT NULL,
    "estudianteId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoAcceso" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "facultad" TEXT NOT NULL,
    "duracionSemestres" INTEGER NOT NULL,
    "valorSemestre" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "programas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semestre" INTEGER NOT NULL,
    "indice" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudiantes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "hashAnonimo" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "edadIngreso" INTEGER NOT NULL,
    "estrato" INTEGER NOT NULL,
    "municipioOrigen" TEXT NOT NULL,
    "departamentoOrigen" TEXT NOT NULL,
    "trabaja" BOOLEAN NOT NULL DEFAULT false,
    "horasTrabajoSemana" INTEGER NOT NULL DEFAULT 0,
    "programaId" TEXT NOT NULL,
    "periodoIngresoId" TEXT NOT NULL,
    "cohorte" TEXT NOT NULL,
    "cohorteAnio" INTEGER NOT NULL,
    "semestreActual" INTEGER NOT NULL,
    "estado" "EstadoEstudiante" NOT NULL DEFAULT 'ACTIVO',
    "consentimientoDatos" BOOLEAN NOT NULL DEFAULT false,
    "fechaConsentimiento" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudiantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,
    "valorMatricula" INTEGER NOT NULL,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_semestre" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL,
    "promedio" DOUBLE PRECISION NOT NULL,
    "materiasInscritas" INTEGER NOT NULL,
    "materiasPerdidas" INTEGER NOT NULL,
    "asistenciaPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "notas_semestre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financiacion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "tipo" "TipoFinanciacion" NOT NULL,
    "porcentajeCubierto" INTEGER NOT NULL,
    "montoTotal" INTEGER NOT NULL,
    "saldoPendiente" INTEGER NOT NULL DEFAULT 0,
    "tasaEA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plazoMeses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "financiacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "causas_desercion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaCausa" NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "causas_desercion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retiros" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "semestreRetiro" INTEGER NOT NULL,
    "fechaRetiro" TIMESTAMP(3) NOT NULL,
    "causaId" TEXT NOT NULL,
    "observacion" TEXT,

    CONSTRAINT "retiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encuestas" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentimiento" BOOLEAN NOT NULL,
    "puntaje" INTEGER,
    "nivel" "NivelRiesgo",

    CONSTRAINT "encuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas_encuesta" (
    "id" TEXT NOT NULL,
    "encuestaId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "dimension" "DimensionEncuesta" NOT NULL,
    "valor" INTEGER NOT NULL,
    "texto" TEXT,

    CONSTRAINT "respuestas_encuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntajes_riesgo" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "periodoId" TEXT,
    "puntaje" INTEGER NOT NULL,
    "nivel" "NivelRiesgo" NOT NULL,
    "factores" JSONB NOT NULL,
    "modeloVersion" TEXT NOT NULL,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puntajes_riesgo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "creadaPorId" TEXT,
    "origen" "OrigenAlerta" NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'ABIERTA',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervenciones" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "tipo" "TipoIntervencion" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "montoApoyo" INTEGER,
    "estado" "EstadoIntervencion" NOT NULL DEFAULT 'EN_CURSO',

    CONSTRAINT "intervenciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_economicos" (
    "id" TEXT NOT NULL,
    "categoria" "CategoriaParametro" NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "unidad" TEXT NOT NULL,
    "descripcion" TEXT,
    "fuente" TEXT,
    "programaId" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPorId" TEXT,

    CONSTRAINT "parametros_economicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_estudianteId_key" ON "usuarios"("estudianteId");

-- CreateIndex
CREATE INDEX "usuarios_rolId_idx" ON "usuarios"("rolId");

-- CreateIndex
CREATE UNIQUE INDEX "programas_nombre_key" ON "programas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_codigo_key" ON "periodos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "periodos_indice_key" ON "periodos"("indice");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_codigo_key" ON "estudiantes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_hashAnonimo_key" ON "estudiantes"("hashAnonimo");

-- CreateIndex
CREATE INDEX "estudiantes_programaId_idx" ON "estudiantes"("programaId");

-- CreateIndex
CREATE INDEX "estudiantes_cohorte_idx" ON "estudiantes"("cohorte");

-- CreateIndex
CREATE INDEX "estudiantes_estado_idx" ON "estudiantes"("estado");

-- CreateIndex
CREATE INDEX "estudiantes_municipioOrigen_idx" ON "estudiantes"("municipioOrigen");

-- CreateIndex
CREATE INDEX "matriculas_periodoId_idx" ON "matriculas"("periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_estudianteId_periodoId_key" ON "matriculas"("estudianteId", "periodoId");

-- CreateIndex
CREATE INDEX "notas_semestre_periodoId_idx" ON "notas_semestre"("periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_semestre_estudianteId_periodoId_key" ON "notas_semestre"("estudianteId", "periodoId");

-- CreateIndex
CREATE INDEX "financiacion_estudianteId_idx" ON "financiacion"("estudianteId");

-- CreateIndex
CREATE INDEX "financiacion_tipo_idx" ON "financiacion"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "causas_desercion_nombre_key" ON "causas_desercion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "retiros_estudianteId_key" ON "retiros"("estudianteId");

-- CreateIndex
CREATE INDEX "retiros_periodoId_idx" ON "retiros"("periodoId");

-- CreateIndex
CREATE INDEX "retiros_causaId_idx" ON "retiros"("causaId");

-- CreateIndex
CREATE INDEX "encuestas_estudianteId_idx" ON "encuestas"("estudianteId");

-- CreateIndex
CREATE INDEX "respuestas_encuesta_encuestaId_idx" ON "respuestas_encuesta"("encuestaId");

-- CreateIndex
CREATE INDEX "puntajes_riesgo_estudianteId_idx" ON "puntajes_riesgo"("estudianteId");

-- CreateIndex
CREATE INDEX "puntajes_riesgo_nivel_idx" ON "puntajes_riesgo"("nivel");

-- CreateIndex
CREATE INDEX "alertas_estudianteId_idx" ON "alertas"("estudianteId");

-- CreateIndex
CREATE INDEX "alertas_estado_idx" ON "alertas"("estado");

-- CreateIndex
CREATE INDEX "intervenciones_estudianteId_idx" ON "intervenciones"("estudianteId");

-- CreateIndex
CREATE INDEX "intervenciones_tipo_idx" ON "intervenciones"("tipo");

-- CreateIndex
CREATE INDEX "parametros_economicos_categoria_idx" ON "parametros_economicos"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_economicos_clave_programaId_key" ON "parametros_economicos"("clave", "programaId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estudiantes" ADD CONSTRAINT "estudiantes_periodoIngresoId_fkey" FOREIGN KEY ("periodoIngresoId") REFERENCES "periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_semestre" ADD CONSTRAINT "notas_semestre_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_semestre" ADD CONSTRAINT "notas_semestre_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financiacion" ADD CONSTRAINT "financiacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros" ADD CONSTRAINT "retiros_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros" ADD CONSTRAINT "retiros_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retiros" ADD CONSTRAINT "retiros_causaId_fkey" FOREIGN KEY ("causaId") REFERENCES "causas_desercion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encuestas" ADD CONSTRAINT "encuestas_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_encuesta" ADD CONSTRAINT "respuestas_encuesta_encuestaId_fkey" FOREIGN KEY ("encuestaId") REFERENCES "encuestas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntajes_riesgo" ADD CONSTRAINT "puntajes_riesgo_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntajes_riesgo" ADD CONSTRAINT "puntajes_riesgo_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "periodos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervenciones" ADD CONSTRAINT "intervenciones_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_economicos" ADD CONSTRAINT "parametros_economicos_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_economicos" ADD CONSTRAINT "parametros_economicos_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

