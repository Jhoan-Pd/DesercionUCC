/**
 * Seed del Observatorio de Deserción UCC.
 * Uso:  npm run db:seed        (equivale a: prisma db seed)
 *
 * Es idempotente: BORRA los datos existentes y vuelve a insertarlos.
 * Las cuentas demo usan la contraseña de SEED_DEMO_PASSWORD (ver .env).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generarDataset } from "./seed/generador";

const prisma = new PrismaClient();

/** Inserta en lotes para no exceder el límite de parámetros de Postgres */
async function insertarPorLotes<T>(items: T[], insertar: (lote: T[]) => Promise<unknown>, tamano = 1000): Promise<void> {
  for (let i = 0; i < items.length; i += tamano) {
    await insertar(items.slice(i, i + tamano));
  }
}

async function main() {
  const inicio = Date.now();
  const passwordDemo = process.env.SEED_DEMO_PASSWORD ?? "Ucc2026!";

  console.log("🧹 Limpiando datos existentes...");
  await prisma.$transaction([
    prisma.respuestaEncuesta.deleteMany(),
    prisma.encuesta.deleteMany(),
    prisma.puntajeRiesgo.deleteMany(),
    prisma.alerta.deleteMany(),
    prisma.intervencion.deleteMany(),
    prisma.retiro.deleteMany(),
    prisma.financiacion.deleteMany(),
    prisma.notaSemestre.deleteMany(),
    prisma.matricula.deleteMany(),
    prisma.parametroEconomico.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.estudiante.deleteMany(),
    prisma.causaDesercion.deleteMany(),
    prisma.periodo.deleteMany(),
    prisma.programa.deleteMany(),
    prisma.rol.deleteMany(),
  ]);

  console.log("🧪 Generando dataset sintético (1.500 estudiantes, cohortes 2018-2025)...");
  const d = generarDataset({ totalEstudiantes: 1500, semilla: 2026 });

  console.log("📚 Insertando catálogos...");
  await prisma.programa.createMany({ data: d.programas });
  await prisma.periodo.createMany({ data: d.periodos });
  await prisma.causaDesercion.createMany({ data: d.causas });

  console.log("🎓 Insertando estudiantes y trayectorias...");
  await insertarPorLotes(d.estudiantes, (data) => prisma.estudiante.createMany({ data }));
  await insertarPorLotes(d.matriculas, (data) => prisma.matricula.createMany({ data }));
  await insertarPorLotes(d.notas, (data) => prisma.notaSemestre.createMany({ data }));
  await insertarPorLotes(d.financiaciones, (data) => prisma.financiacion.createMany({ data }));
  await insertarPorLotes(d.retiros, (data) => prisma.retiro.createMany({ data }));

  console.log("⚙️  Insertando parámetros económicos y referencias SPADIES...");
  await prisma.parametroEconomico.createMany({ data: d.parametros });

  console.log("👤 Creando roles y usuarios demo...");
  const nombresRol = [
    { nombre: "ADMIN", descripcion: "Administra programas, periodos, usuarios y parámetros" },
    { nombre: "BIENESTAR", descripcion: "Consejeros de Bienestar Universitario: ven datos individuales y registran intervenciones" },
    { nombre: "DOCENTE", descripcion: "Docentes: ven a los estudiantes de sus cursos y reportan alertas" },
    { nombre: "ESTUDIANTE", descripcion: "Estudiantes: calculadora de impacto y encuesta de autoevaluación" },
  ];
  await prisma.rol.createMany({ data: nombresRol });
  const roles = await prisma.rol.findMany();
  const rolId = (nombre: string) => roles.find((r) => r.nombre === nombre)!.id;

  const passwordHash = await bcrypt.hash(passwordDemo, 10);

  // El estudiante demo: activo, en mitad de la carrera y con deuda, para que la calculadora sea ilustrativa
  const candidatoDemo =
    d.estudiantes.find((e) => {
      if (e.estado !== "ACTIVO" || e.semestreActual < 3 || e.semestreActual > 6) return false;
      const fin = d.financiaciones.find((f) => f.estudianteId === e.id);
      return fin?.tipo === "ICETEX";
    }) ?? d.estudiantes.find((e) => e.estado === "ACTIVO");

  await prisma.usuario.createMany({
    data: [
      { email: "admin@ucc.edu.co", nombre: "Administrador del Observatorio", passwordHash, rolId: rolId("ADMIN") },
      { email: "bienestar@ucc.edu.co", nombre: "Consejera de Bienestar", passwordHash, rolId: rolId("BIENESTAR") },
      { email: "docente@ucc.edu.co", nombre: "Docente Demo", passwordHash, rolId: rolId("DOCENTE") },
      {
        email: "estudiante@ucc.edu.co",
        nombre: candidatoDemo ? `${candidatoDemo.nombres} ${candidatoDemo.apellidos}` : "Estudiante Demo",
        passwordHash,
        rolId: rolId("ESTUDIANTE"),
        estudianteId: candidatoDemo?.id ?? null,
      },
    ],
  });

  const desertores = d.estudiantes.filter((e) => e.estado === "DESERTOR").length;
  console.log("\n✅ Seed completado en", ((Date.now() - inicio) / 1000).toFixed(1), "s");
  console.log(`   Estudiantes: ${d.estudiantes.length} (desertores: ${desertores}, tasa acumulada ${((100 * desertores) / d.estudiantes.length).toFixed(1)}%)`);
  console.log(`   Matrículas: ${d.matriculas.length} · Notas: ${d.notas.length} · Retiros: ${d.retiros.length}`);
  console.log("   Usuarios demo: admin@ucc.edu.co, bienestar@ucc.edu.co, docente@ucc.edu.co, estudiante@ucc.edu.co");
  console.log("   Contraseña: la definida en SEED_DEMO_PASSWORD (.env)");
}

main()
  .catch((e) => {
    console.error("❌ Error en el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
