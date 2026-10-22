-- El método de cálculo del riesgo pasa de texto libre a un enum: la base de datos rechaza valores
-- distintos de FACTORES y MODELO, y el cliente de Prisma lo tipa sin conversiones.

-- CreateEnum
CREATE TYPE "MetodoRiesgo" AS ENUM ('FACTORES', 'MODELO');

-- AlterTable (los valores existentes ya son FACTORES o MODELO)
ALTER TABLE "evaluaciones" ALTER COLUMN "metodo" TYPE "MetodoRiesgo" USING ("metodo"::"MetodoRiesgo");
