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
import { generarCursos, type DocenteSeed } from "./seed/academico";
import { Aleatorio, acotar } from "./seed/aleatorio";
import { cargarRegistros } from "../services/riesgo/registros";
import { ModeloRiesgo } from "../services/riesgo/ModeloRiesgo";
import { MODELO_BASE, factoresParaGuardar, motivoAlertaModelo, puntuarRegistros } from "../services/riesgo/puntuacion";
import { EvaluadorEncuesta } from "../services/encuesta/EvaluadorEncuesta";
import { PREGUNTAS } from "../services/encuesta/preguntas";

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
    prisma.auditoriaAcceso.deleteMany(),
    prisma.importacion.deleteMany(),
    prisma.inscripcion.deleteMany(),
    prisma.respuestaEncuesta.deleteMany(),
    prisma.encuesta.deleteMany(),
    prisma.puntajeRiesgo.deleteMany(),
    prisma.alerta.deleteMany(),
    prisma.curso.deleteMany(),
    prisma.modeloRiesgo.deleteMany(),
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

  // ------------------------------------------------------------------
  // Fase 2: docentes, cursos del periodo, modelo de riesgo, puntajes, alertas y encuestas
  // ------------------------------------------------------------------
  console.log("👩‍🏫 Creando docentes, cursos e inscripciones del periodo en curso...");
  const nombresDocentes = [
    "María Fernanda Rosero", "Carlos Andrés Burbano", "Diana Lucía Erazo", "Jorge Eduardo Benavides",
    "Paola Andrea Muñoz", "Andrés Felipe Guerrero", "Lina Marcela Ortega", "Juan Pablo Insuasty",
  ];
  await prisma.usuario.createMany({
    data: nombresDocentes.map((nombre, i) => ({ email: `docente${i + 2}@ucc.edu.co`, nombre, passwordHash, rolId: rolId("DOCENTE") })),
  });
  const usuariosDocentes = await prisma.usuario.findMany({ where: { rol: { nombre: "DOCENTE" } }, select: { id: true, email: true } });
  const docentes: DocenteSeed[] = usuariosDocentes.map((u) => ({ id: u.id, demo: u.email === "docente@ucc.edu.co" }));
  const { cursos, inscripciones } = generarCursos(d, docentes);
  await prisma.curso.createMany({ data: cursos });
  await insertarPorLotes(inscripciones, (data) => prisma.inscripcion.createMany({ data }));

  console.log("🧠 Registrando el modelo de riesgo y calculando puntajes...");
  const modelo = new ModeloRiesgo(MODELO_BASE.definicion);
  await prisma.modeloRiesgo.create({
    data: {
      version: modelo.version,
      origen: modelo.definicion.origen,
      definicion: modelo.definicion,
      metricas: MODELO_BASE.metricas as object,
      activo: true,
    },
  });
  const periodoActual = d.periodos.find((p) => p.activo)!;
  const registros = await cargarRegistros(prisma, { soloEstados: ["ACTIVO", "APLAZADO"] });
  const puntajes = puntuarRegistros(modelo, registros);
  await insertarPorLotes(puntajes, (lote) =>
    prisma.puntajeRiesgo.createMany({
      data: lote.map((p) => ({
        estudianteId: p.estudianteId,
        periodoId: periodoActual.id,
        puntaje: p.prediccion.puntaje,
        nivel: p.prediccion.nivel,
        factores: factoresParaGuardar(p.prediccion) as unknown as object,
        modeloVersion: modelo.version,
      })),
    }),
  );

  const r = new Aleatorio(2028);
  const enPeriodo = (fraccion: number) => new Date(periodoActual.fechaInicio.getTime() + (Date.UTC(2026, 9, 5) - periodoActual.fechaInicio.getTime()) * fraccion);
  const altos = puntajes.filter((p) => p.prediccion.nivel === "ALTO");
  await prisma.alerta.createMany({
    data: altos.map((p) => ({
      estudianteId: p.estudianteId,
      origen: "MODELO" as const,
      motivo: motivoAlertaModelo(p.prediccion),
      estado: r.bernoulli(0.35) ? ("EN_SEGUIMIENTO" as const) : ("ABIERTA" as const),
      creadaEn: enPeriodo(r.rango(0.3, 0.6)),
    })),
  });

  // Alertas reportadas por el docente demo (solo algunas: el resto queda para probar el panel)
  const docenteDemo = docentes.find((x) => x.demo)!;
  const cursosDemo = new Set(cursos.filter((c) => c.docenteId === docenteDemo.id).map((c) => c.id));
  const nombreCurso = new Map(cursos.map((c) => [c.id, `${c.codigo} ${c.nombre}`]));
  const criticas = inscripciones.filter((i) => cursosDemo.has(i.cursoId) && ((i.notaParcial ?? 5) < 2.8 || i.asistenciaPct < 72));
  const reportadas = criticas.filter((_, i) => i % 2 === 0).slice(0, 8);
  await prisma.alerta.createMany({
    data: reportadas.map((i) => ({
      estudianteId: i.estudianteId,
      creadaPorId: docenteDemo.id,
      cursoId: i.cursoId,
      origen: "DOCENTE" as const,
      motivo: `${(i.notaParcial ?? 5) < 2.8 ? `Nota parcial de ${i.notaParcial?.toLocaleString("es-CO")}` : `Asistencia del ${i.asistenciaPct.toLocaleString("es-CO")} %`} en ${nombreCurso.get(i.cursoId)}.`,
      creadaEn: enPeriodo(r.rango(0.6, 0.9)),
    })),
  });

  // Encuestas de autoevaluación de una muestra de estudiantes activos (no del estudiante demo)
  console.log("📝 Generando encuestas de autoevaluación de ejemplo...");
  const muestra = puntajes.filter((p) => p.estudianteId !== candidatoDemo?.id && r.bernoulli(0.18));
  let alertasEncuesta = 0;
  for (const p of muestra) {
    const latente = acotar(p.prediccion.probabilidad * 2.2 + r.normal(0, 0.12), 0, 1);
    const respuestas = Object.fromEntries(
      PREGUNTAS.map((q) => {
        const riesgo = acotar(latente + r.normal(0, 0.22), 0, 1);
        const v = 1 + Math.round(riesgo * 4);
        return [q.clave, q.invertida ? 6 - v : v];
      }),
    );
    const res = EvaluadorEncuesta.evaluar(respuestas);
    const autoriza = r.bernoulli(0.7);
    const fecha = enPeriodo(r.rango(0.2, 0.95));
    await prisma.encuesta.create({
      data: {
        estudianteId: p.estudianteId,
        fecha,
        consentimiento: true,
        autorizaContacto: autoriza,
        puntaje: res.puntaje,
        nivel: res.nivel,
        puntajesDimension: res.puntajesDimension,
        respuestas: { create: PREGUNTAS.map((q) => ({ clave: q.clave, dimension: q.dimension, valor: respuestas[q.clave] })) },
      },
    });
    if (res.nivel === "ALTO" && autoriza) {
      alertasEncuesta++;
      await prisma.alerta.create({
        data: { estudianteId: p.estudianteId, origen: "ENCUESTA", motivo: `Encuesta de autoevaluación con riesgo ALTO (${res.puntaje}/100). Dimensión más crítica: ${res.dimensionesCriticas[0].toLowerCase()}.`, creadaEn: fecha },
      });
    }
  }
  console.log(`   Cursos: ${cursos.length} · Inscripciones: ${inscripciones.length} · Puntajes: ${puntajes.length} (ALTO ${altos.length}) · Encuestas: ${muestra.length} (alertas ${alertasEncuesta})`);

  const desertores = d.estudiantes.filter((e) => e.estado === "DESERTOR").length;
  console.log("\n✅ Seed completado en", ((Date.now() - inicio) / 1000).toFixed(1), "s");
  console.log(`   Estudiantes: ${d.estudiantes.length} (desertores: ${desertores}, tasa acumulada ${((100 * desertores) / d.estudiantes.length).toFixed(1)}%)`);
  console.log(`   Matrículas: ${d.matriculas.length} · Notas: ${d.notas.length} · Retiros: ${d.retiros.length}`);
  console.log("   Usuarios demo: admin@ucc.edu.co, bienestar@ucc.edu.co, docente@ucc.edu.co (y docente2..docente9), estudiante@ucc.edu.co");
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
