"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Calculator, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { entradaImpactoSchema } from "@/lib/validators/impacto";
import type { Rol } from "@/lib/roles";
import type { EntradaImpacto, ResultadoImpacto } from "@/services/impacto/tipos";
import type { PerfilImpacto } from "@/services/impacto/ServicioImpacto";
import { ResultadosImpacto } from "./ResultadosImpacto";

/** Valores del formulario (planos). Los porcentajes se escriben como 11 y se envían como 0.11 */
interface Valores {
  programaId: string;
  semestresCursados: number;
  matriculaTotalPagada?: number;
  transporteMensual: number;
  materialesSemestre: number;
  sostenimientoMensual: number;
  tipoFinanciacion: EntradaImpacto["financiacion"]["tipo"];
  porcentajeFinanciado: number;
  saldoDeuda?: number;
  tasaPct: number;
  plazoMeses: number;
  salarioProfesionalMensual: number;
  nivelAlternativo: EntradaImpacto["nivelAlternativo"];
  ingresoMensualActual: number;
}

const aNumero = (v: number | undefined): number | undefined => (v !== undefined && Number.isFinite(v) ? v : undefined);

function aFormulario(perfil: PerfilImpacto): Valores {
  const e = perfil.entrada;
  return {
    programaId: perfil.programaId,
    semestresCursados: e.semestresCursados,
    matriculaTotalPagada: e.matriculaTotalPagada,
    transporteMensual: e.transporteMensual,
    materialesSemestre: e.materialesSemestre,
    sostenimientoMensual: e.sostenimientoMensual,
    tipoFinanciacion: e.financiacion.tipo,
    porcentajeFinanciado: e.financiacion.porcentajeFinanciado,
    saldoDeuda: e.financiacion.saldoDeuda,
    tasaPct: Math.round(e.financiacion.tasaEA * 10000) / 100,
    plazoMeses: e.financiacion.plazoMeses,
    salarioProfesionalMensual: e.salarioProfesionalMensual,
    nivelAlternativo: e.nivelAlternativo,
    ingresoMensualActual: e.ingresoMensualActual,
  };
}

interface Props {
  perfilInicial: PerfilImpacto;
  rol: Rol;
}

async function pedirJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalles = Array.isArray(cuerpo.detalles) ? cuerpo.detalles.map((d: { campo: string; mensaje: string }) => `${d.campo}: ${d.mensaje}`).join(" · ") : "";
    throw new Error([cuerpo.error ?? "Error inesperado", detalles].filter(Boolean).join(" — "));
  }
  return cuerpo as T;
}

export function CalculadoraImpactoForm({ perfilInicial, rol }: Props) {
  const [perfil, setPerfil] = useState<PerfilImpacto>(perfilInicial);
  const [resultado, setResultado] = useState<ResultadoImpacto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [codigo, setCodigo] = useState("");
  const resultadosRef = useRef<HTMLDivElement>(null);

  const esEstudianteConPerfil = rol === "ESTUDIANTE" && perfil.estudiante !== null;
  const puedeBuscarEstudiante = rol === "ADMIN" || rol === "BIENESTAR";

  const { register, handleSubmit, reset, watch, getValues, setValue } = useForm<Valores>({ defaultValues: aFormulario(perfilInicial) });
  const tipoFin = watch("tipoFinanciacion");
  // Ojo: un <select disabled> devuelve undefined en React Hook Form; si el estudiante tiene el
  // programa bloqueado, el programa se toma del perfil y no del campo.
  const programaSeleccionado = watch("programaId");
  const programaId = esEstudianteConPerfil ? perfil.programaId : programaSeleccionado;
  const programa = perfil.programas.find((p) => p.id === programaId) ?? perfil.programas[0];

  /** Al elegir un crédito se propone su tasa de referencia (editable) y un plazo si estaba en 0 */
  function alCambiarFinanciacion(tipo: Valores["tipoFinanciacion"]) {
    const ref = perfil.referenciasCredito;
    if (tipo === "ICETEX" || tipo === "CREDITO_UCC") {
      setValue("tasaPct", tipo === "ICETEX" ? ref.tasaIcetexPct : ref.tasaCreditoUccPct);
      if (!getValues("plazoMeses")) setValue("plazoMeses", ref.plazoMeses);
    }
  }

  async function cargarPerfil(url: string) {
    setCargandoPerfil(true);
    setError(null);
    try {
      const nuevo = await pedirJson<PerfilImpacto>(url);
      setPerfil(nuevo);
      reset(aFormulario(nuevo));
      setResultado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible cargar el perfil.");
    } finally {
      setCargandoPerfil(false);
    }
  }

  async function onSubmit(v: Valores) {
    setError(null);
    const entrada: EntradaImpacto = {
      programa: { nombre: programa.nombre, duracionSemestres: programa.duracionSemestres, valorSemestre: programa.valorSemestre },
      semestresCursados: v.semestresCursados,
      matriculaTotalPagada: aNumero(v.matriculaTotalPagada),
      transporteMensual: v.transporteMensual,
      materialesSemestre: v.materialesSemestre,
      sostenimientoMensual: v.sostenimientoMensual,
      financiacion: {
        tipo: v.tipoFinanciacion,
        porcentajeFinanciado: v.porcentajeFinanciado,
        saldoDeuda: aNumero(v.saldoDeuda),
        tasaEA: v.tasaPct / 100,
        plazoMeses: v.plazoMeses,
      },
      salarioProfesionalMensual: v.salarioProfesionalMensual,
      nivelAlternativo: v.nivelAlternativo,
      ingresoMensualActual: v.ingresoMensualActual,
    };

    // Validación en el cliente con el MISMO esquema Zod que usa el servidor
    const valido = entradaImpactoSchema.safeParse(entrada);
    if (!valido.success) {
      setError(valido.error.issues.map((i) => i.message).join(" · "));
      return;
    }

    setCalculando(true);
    try {
      const res = await pedirJson<ResultadoImpacto>("/api/impacto/calcular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valido.data),
      });
      setResultado(res);
      setTimeout(() => resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible calcular.");
    } finally {
      setCalculando(false);
    }
  }

  const num = (id: keyof Valores, etiqueta: string, ayuda?: string, extra?: { min?: number; max?: number; step?: number; opcional?: boolean }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={extra?.min ?? 0}
        max={extra?.max}
        step={extra?.step ?? "any"}
        placeholder={extra?.opcional ? "Opcional" : undefined}
        {...register(id, { valueAsNumber: true })}
      />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );

  return (
    <div className="space-y-8">
      {esEstudianteConPerfil && perfil.estudiante && (
        <Alert variant="info" titulo="Tus datos académicos ya están cargados">
          Programa y financiación vienen de tu registro (semestre actual: {perfil.estudiante.semestreActual}). Puedes ajustar cualquier valor para simular distintos escenarios.
        </Alert>
      )}
      {!esEstudianteConPerfil && perfil.estudiante && (
        <Alert variant="warning" titulo={`Consulta individual: ${perfil.estudiante.nombre} (${perfil.estudiante.codigo})`}>
          Estás viendo datos personales de un estudiante. Esta consulta queda registrada (Ley 1581 de 2012).
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {puedeBuscarEstudiante && (
          <Card>
            <CardHeader>
              <CardTitle>Cargar un estudiante (opcional)</CardTitle>
              <CardDescription>Bienestar y administración pueden precargar la calculadora con el perfil de un estudiante por su código.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="codigo">Código del estudiante</Label>
                <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.trim())} placeholder="Ej. UCC202110001" />
              </div>
              <Button type="button" variant="outline" disabled={codigo.length < 3 || cargandoPerfil} onClick={() => cargarPerfil(`/api/impacto/perfil?codigo=${encodeURIComponent(codigo)}`)}>
                {cargandoPerfil ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />} Cargar perfil
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>1. Tu carrera</CardTitle>
              <CardDescription>Lo que has estudiado y lo que has gastado.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="programaId">Programa</Label>
                {esEstudianteConPerfil ? (
                  <p id="programaId" className="flex h-10 items-center rounded-md border bg-secondary/50 px-3 text-sm font-medium">{programa.nombre}</p>
                ) : (
                  <Select
                    id="programaId"
                    {...register("programaId", {
                      onChange: (e) => cargarPerfil(`/api/impacto/perfil?programaId=${e.target.value}`),
                    })}
                  >
                    {perfil.programas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Duración: {programa.duracionSemestres} semestres · Matrícula por semestre: {programa.valorSemestre.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="semestresCursados">Semestres cursados o pagados</Label>
                <Input
                  id="semestresCursados"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={programa.duracionSemestres}
                  step={1}
                  {...register("semestresCursados", {
                    valueAsNumber: true,
                    // La matrícula real cargada corresponde a otros semestres: se limpia para estimarla de nuevo
                    onChange: () => setValue("matriculaTotalPagada", undefined),
                  })}
                />
                <p className="text-xs text-muted-foreground">Incluye el semestre en curso si ya lo pagaste ({programa.duracionSemestres} en total)</p>
              </div>
              {num("matriculaTotalPagada", "Matrícula total pagada (COP)", "Si no la sabes, déjala vacía: se estima.", { opcional: true })}
              {num("transporteMensual", "Transporte mensual (COP)")}
              {num("materialesSemestre", "Materiales por semestre (COP)")}
              <div className="sm:col-span-2">{num("sostenimientoMensual", "Sostenimiento mensual (COP)", "Alimentación, vivienda y servicios.")}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Financiación y futuro</CardTitle>
              <CardDescription>Cómo pagas y cuánto ganarías con y sin título.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tipoFinanciacion">Fuente de financiación</Label>
                <Select id="tipoFinanciacion" {...register("tipoFinanciacion", { onChange: (e) => alCambiarFinanciacion(e.target.value) })}>
                  <option value="RECURSOS_PROPIOS">Recursos propios</option>
                  <option value="ICETEX">ICETEX</option>
                  <option value="BECA">Beca</option>
                  <option value="CREDITO_UCC">Crédito UCC</option>
                </Select>
              </div>
              {num("porcentajeFinanciado", "% de matrícula cubierto", "0 a 100", { max: 100, step: 1 })}
              {(tipoFin === "ICETEX" || tipoFin === "CREDITO_UCC") && (
                <>
                  {num("saldoDeuda", "Saldo de la deuda (COP)", "Opcional: si no, se estima.", { opcional: true })}
                  {num("tasaPct", "Tasa efectiva anual (%)", "Ej. 11 para 11%", { max: 100 })}
                  {num("plazoMeses", "Plazo de pago (meses)", "Tiempo para pagar la deuda", { max: 240, step: 1 })}
                </>
              )}
              {num("ingresoMensualActual", "Ingreso mensual actual (COP)", "Lo que ganas hoy mientras estudias (0 si no trabajas).")}
              {num("salarioProfesionalMensual", "Ingreso mensual como profesional (COP)", "Salario de enganche de tu programa (editable).")}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nivelAlternativo">Si te retiras, compárate con…</Label>
                <Select id="nivelAlternativo" {...register("nivelAlternativo")}>
                  <option value="BACHILLER">Bachiller (sin título superior)</option>
                  <option value="TECNICO">Técnico profesional</option>
                  <option value="TECNOLOGO">Tecnólogo</option>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && <Alert variant="error" titulo="Revisa los datos">{error}</Alert>}

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={calculando || cargandoPerfil}>
            {calculando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Calculator className="h-4 w-4" aria-hidden />}
            {calculando ? "Calculando..." : "Calcular impacto"}
          </Button>
        </div>
      </form>

      <div ref={resultadosRef} aria-live="polite">
        {resultado && <ResultadosImpacto r={resultado} />}
      </div>
    </div>
  );
}
