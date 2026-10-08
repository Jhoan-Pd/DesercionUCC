"use client";

import { AlertTriangle, CircleDollarSign, Clock, Landmark, TrendingDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { TarjetaGrafica } from "@/components/dashboard/TarjetaGrafica";
import { textoLeyenda } from "@/components/dashboard/leyenda";
import { COLOR } from "@/lib/colores";
import { formatoCOP, formatoCOPCompacto, formatoPct } from "@/lib/utils";
import type { ResultadoImpacto, TipoEscenario } from "@/services/impacto/tipos";

/** Color fijo por escenario (la identidad no cambia aunque cambie el número de series) */
const COLOR_ESCENARIO: Record<Exclude<TipoEscenario, "RETIRARSE">, string> = {
  CONTINUAR: "#2a78d6",
  APLAZAR: "#4a3aa7", // el naranja queda reservado para "retirarme / referencia"
  NOCTURNA_VIRTUAL: "#1baf7a",
  APOYO_FINANCIERO: "#eda100",
};
const NOMBRE_ESCENARIO: Record<string, string> = {
  CONTINUAR: "Continuar",
  APLAZAR: "Aplazar un semestre",
  NOCTURNA_VIRTUAL: "Nocturna / virtual",
  APOYO_FINANCIERO: "Apoyo financiero",
};

function Tarjeta({ titulo, valor, detalle, icono, tono }: { titulo: string; valor: string; detalle: string; icono: React.ReactNode; tono?: "alerta" }) {
  return (
    <Card className={tono === "alerta" ? "border-destructive/30 bg-red-50/60" : undefined}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          <p className="text-2xl font-bold tracking-tight">{valor}</p>
          <p className="text-xs text-muted-foreground">{detalle}</p>
        </div>
        <span className="rounded-lg bg-secondary p-2 text-primary">{icono}</span>
      </CardContent>
    </Card>
  );
}

function BarraProporcion({ etiqueta, valor, total }: { etiqueta: string; valor: number; total: number }) {
  const p = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{etiqueta}</span>
        <span className="font-semibold">{formatoCOP(valor)} <span className="font-normal text-muted-foreground">({formatoPct(p, 0)})</span></span>
      </div>
      <div className="h-2 rounded-full bg-secondary" role="presentation">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function Burbuja({ titulo, lineas }: { titulo: string; lineas: { etiqueta: string; valor: string; color?: string }[] }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{titulo}</p>
      {lineas.map((l) => (
        <p key={l.etiqueta} className="flex items-center gap-2 text-muted-foreground">
          {l.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} aria-hidden />}
          {l.etiqueta}: <span className="font-semibold text-foreground">{l.valor}</span>
        </p>
      ))}
    </div>
  );
}
type TP = TooltipProps<number, string>;

export function ResultadosImpacto({ r }: { r: ResultadoImpacto }) {
  const h20 = r.costoOportunidad.horizontes.find((h) => h.anios === 20) ?? r.costoOportunidad.horizontes[0];
  const continuar = r.escenarios.find((e) => e.tipo === "CONTINUAR");
  const { inversion, deuda } = r;
  const niv = r.costoOportunidad.nivelAlternativo === "BACHILLER" ? "bachiller" : r.costoOportunidad.nivelAlternativo === "TECNICO" ? "técnico" : "tecnólogo";

  const datosHorizonte = r.costoOportunidad.horizontes.map((h) => ({
    horizonte: `${h.anios} años`,
    graduarme: Math.round(h.vpnProfesional),
    retirarme: Math.round(h.vpnAlternativo),
  }));
  const datosSerie = r.serieVentaja.map((p) => ({ ...p }));

  return (
    <section className="space-y-6" aria-label="Resultados del cálculo">
      <h2 className="text-xl font-bold">Resultados</h2>

      <Alert variant={h20.vpnDiferenciaNeta > 0 ? "warning" : "info"} titulo="En pocas palabras">
        {r.conclusion}
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Dinero invertido hasta hoy" valor={formatoCOP(inversion.total)} detalle="Matrícula + transporte + materiales + sostenimiento" icono={<CircleDollarSign className="h-5 w-5" aria-hidden />} />
        <Tarjeta
          titulo="Deuda pendiente"
          valor={deuda.tieneDeuda ? formatoCOP(deuda.saldo) : "Sin deuda"}
          detalle={deuda.tieneDeuda ? `Cuota estimada ${formatoCOP(deuda.cuotaMensual)} / mes` : "No hay crédito educativo vigente"}
          icono={<Landmark className="h-5 w-5" aria-hidden />}
          tono={deuda.tieneDeuda ? "alerta" : undefined}
        />
        <Tarjeta
          titulo={`Costo de oportunidad a ${h20.anios} años`}
          valor={formatoCOP(Math.max(0, h20.vpnDiferenciaNeta))}
          detalle={`Valor presente neto frente a quedarte como ${niv}`}
          icono={<TrendingDown className="h-5 w-5" aria-hidden />}
          tono="alerta"
        />
        <Tarjeta
          titulo="Recuperas la inversión en"
          valor={r.costoOportunidad.puntoEquilibrioAnios === null ? "No en 30 años" : `${r.costoOportunidad.puntoEquilibrioAnios.toLocaleString("es-CO")} años`}
          detalle={`Terminar tus ${r.semestresRestantes} semestres restantes`}
          icono={<Clock className="h-5 w-5" aria-hidden />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dinero invertido</CardTitle>
            <CardDescription>Lo que ya pusiste en la carrera (se pierde como «costo hundido» si te retiras).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BarraProporcion etiqueta="Matrícula" valor={inversion.matricula} total={inversion.total} />
            <BarraProporcion etiqueta="Transporte" valor={inversion.transporte} total={inversion.total} />
            <BarraProporcion etiqueta="Materiales" valor={inversion.materiales} total={inversion.total} />
            <BarraProporcion etiqueta="Sostenimiento" valor={inversion.sostenimiento} total={inversion.total} />
            <div className="rounded-md bg-secondary/60 p-3 text-sm">
              <p className="font-semibold">¿Quién lo pagó?</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>Con deuda (ICETEX / crédito): <b className="text-foreground">{formatoCOP(inversion.matriculaConDeuda)}</b></li>
                <li>Con beca: <b className="text-foreground">{formatoCOP(inversion.matriculaConBeca)}</b></li>
                <li>Del bolsillo del estudiante y su familia: <b className="text-foreground">{formatoCOP(inversion.aporteDirecto)}</b></li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deuda y cómo se paga sin título</CardTitle>
            <CardDescription>Retirarte no cancela la deuda: se paga con los ingresos que tengas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deuda.tieneDeuda ? (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-muted-foreground">Saldo</dt><dd className="font-semibold">{formatoCOP(deuda.saldo)}</dd></div>
                  <div><dt className="text-muted-foreground">Cuota mensual</dt><dd className="font-semibold">{formatoCOP(deuda.cuotaMensual)}</dd></div>
                  <div><dt className="text-muted-foreground">Total a pagar</dt><dd className="font-semibold">{formatoCOP(deuda.totalAPagar)}</dd></div>
                  <div><dt className="text-muted-foreground">Intereses</dt><dd className="font-semibold">{formatoCOP(deuda.totalIntereses)}</dd></div>
                </dl>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-destructive/30 bg-red-50 p-3">
                    <p className="text-xs text-muted-foreground">Sin título ({niv})</p>
                    <p className="text-2xl font-bold text-destructive">{formatoPct(deuda.cuotaSobreIngresoSinTitulo)}</p>
                    <p className="text-xs text-muted-foreground">de tu ingreso se va en la cuota</p>
                  </div>
                  <div className="rounded-md border border-green-200 bg-green-50 p-3">
                    <p className="text-xs text-muted-foreground">Con título</p>
                    <p className="text-2xl font-bold text-green-800">{formatoPct(deuda.cuotaSobreIngresoConTitulo)}</p>
                    <p className="text-xs text-muted-foreground">de tu ingreso se va en la cuota</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  El saldo equivale a <b className="text-foreground">{deuda.mesesDeSalarioSinTitulo.toLocaleString("es-CO", { maximumFractionDigits: 1 })} meses</b> de tu ingreso sin título.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No registraste una deuda de crédito educativo; no habría cuotas por pagar tras retirarte.</p>
            )}
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>La cuota se calcula con el sistema francés (cuota fija) a la tasa y plazo indicados; es una estimación.</li>
              <li>Antes de decidir, consulta con ICETEX o la oficina financiera de la UCC las condiciones reales de tu crédito (periodos de gracia, alivios, reliquidación).</li>
              <li>Retirarte sin pagar puede afectar tu historial crediticio.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <TarjetaGrafica
        titulo="Costo de oportunidad: ingresos graduándote vs. retirándote"
        descripcion={`Valor presente de lo que ganarías en 10, 20 y 30 años. Alternativa: ${niv} (${formatoCOP(r.costoOportunidad.salarioAlternativoInicial)}/mes); profesional (${formatoCOP(r.costoOportunidad.salarioProfesionalInicial)}/mes).`}
        nota={`Valor presente: descuenta cada peso futuro con una tasa de ${formatoPct(r.supuestos.tasaDescuento * 100, 1)} anual. Cifras en pesos de hoy (sin inflación).`}
        tabla={{
          columnas: ["Horizonte", "Ingreso nominal graduado", "Ingreso nominal retirado", "VPN graduado", "VPN retirado", "VPN diferencia (ingresos)", "VPN diferencia neta"],
          filas: r.costoOportunidad.horizontes.map((h) => [
            `${h.anios} años`,
            formatoCOP(h.ingresoProfesionalNominal),
            formatoCOP(h.ingresoAlternativoNominal),
            formatoCOP(h.vpnProfesional),
            formatoCOP(h.vpnAlternativo),
            formatoCOP(h.vpnDiferenciaIngresos),
            formatoCOP(h.vpnDiferenciaNeta),
          ]),
        }}
      >
        <div className="h-80" role="img" aria-label="Gráfica de barras agrupadas: valor presente de los ingresos graduándose frente a retirándose, a 10, 20 y 30 años">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datosHorizonte} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="horizonte" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatoCOPCompacto(v)} width={72} />
              <Tooltip
                cursor={{ fill: "rgba(0,84,159,0.06)" }}
                content={({ active, payload, label }: TP) => {
                  if (!active || !payload?.length) return null;
                  const g = Number(payload.find((p) => p.dataKey === "graduarme")?.value ?? 0);
                  const t = Number(payload.find((p) => p.dataKey === "retirarme")?.value ?? 0);
                  return (
                    <Burbuja
                      titulo={`A ${label}`}
                      lineas={[
                        { etiqueta: "Graduándote", valor: formatoCOP(g), color: "#2a78d6" },
                        { etiqueta: `Como ${niv}`, valor: formatoCOP(t), color: COLOR.referencia },
                        { etiqueta: "Diferencia", valor: formatoCOP(g - t) },
                      ]}
                    />
                  );
                }}
              />
              <Legend formatter={textoLeyenda} verticalAlign="top" height={28} />
              <Bar dataKey="graduarme" name="Graduándome (incluye estudiar)" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={48} />
              <Bar dataKey="retirarme" name={`Retirándome (${niv})`} fill={COLOR.referencia} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </TarjetaGrafica>

      <TarjetaGrafica
        titulo="Comparar escenarios: ventaja frente a retirarte"
        descripcion="Valor presente acumulado de cada camino menos el de retirarte (línea en 0). Donde la curva cruza 0 recuperas lo invertido."
        nota="Supuestos: el sostenimiento no se incluye porque se paga igual estudiando o trabajando; la deuda existente se paga en todos los escenarios."
        tabla={{
          columnas: ["Año", ...Object.values(NOMBRE_ESCENARIO)],
          filas: datosSerie.filter((p) => p.anio % 5 === 0).map((p) => [`${p.anio}`, ...Object.keys(NOMBRE_ESCENARIO).map((k) => formatoCOP(p[k]))]),
        }}
      >
        <div className="h-96" role="img" aria-label="Gráfica de líneas: ventaja acumulada en valor presente de cada escenario frente a retirarse, de 0 a 30 años">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datosSerie} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="anio" tick={{ fontSize: 12 }} label={{ value: "Años desde hoy", position: "insideBottom", offset: -2, fontSize: 12 }} height={40} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatoCOPCompacto(v)} width={72} />
              <Tooltip
                content={({ active, payload, label }: TP) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <Burbuja
                      titulo={`Año ${label}`}
                      lineas={payload.map((p) => ({ etiqueta: NOMBRE_ESCENARIO[String(p.dataKey)] ?? String(p.name), valor: formatoCOP(Number(p.value ?? 0)), color: String(p.color) }))}
                    />
                  );
                }}
              />
              <Legend formatter={textoLeyenda} verticalAlign="top" height={30} iconType="plainline" />
              <ReferenceLine y={0} stroke={COLOR.tinta} strokeWidth={1.5} label={{ value: "Retirarme", position: "insideBottomRight", fontSize: 11 }} />
              {(Object.keys(COLOR_ESCENARIO) as (keyof typeof COLOR_ESCENARIO)[]).map((k) => (
                <Line key={k} dataKey={k} name={NOMBRE_ESCENARIO[k]} stroke={COLOR_ESCENARIO[k]} strokeWidth={2.25} dot={false} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TarjetaGrafica>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por escenario</CardTitle>
          <CardDescription>Ventaja en valor presente frente a retirarte, a 10, 20 y 30 años.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Escenario</TH>
                <TH>Título en</TH>
                <TH>Costo restante</TH>
                <TH>Ventaja a 10 años</TH>
                <TH>Ventaja a 20 años</TH>
                <TH>Ventaja a 30 años</TH>
                <TH>Equilibrio</TH>
              </TR>
            </THead>
            <TBody>
              {r.escenarios.map((e) => (
                <TR key={e.tipo}>
                  <TD>
                    <p className="font-medium">{e.etiqueta}</p>
                    <p className="max-w-xs text-xs text-muted-foreground">{e.descripcion}</p>
                  </TD>
                  <TD>{e.mesesHastaTitulo === null ? "—" : `${(e.mesesHastaTitulo / 12).toLocaleString("es-CO", { maximumFractionDigits: 1 })} años`}</TD>
                  <TD>{e.tipo === "RETIRARSE" ? "—" : formatoCOP(e.costoRestante)}</TD>
                  {[10, 20, 30].map((h) => (
                    <TD key={h} className={e.ventajaVsRetiro[h] < 0 ? "text-destructive" : undefined}>
                      {e.tipo === "RETIRARSE" ? "Base" : formatoCOP(e.ventajaVsRetiro[h])}
                    </TD>
                  ))}
                  <TD>
                    {e.tipo === "RETIRARSE" ? "—" : e.puntoEquilibrioAnios === null ? <Badge variant="danger">No se recupera</Badge> : e.puntoEquilibrioAnios === 0 ? <Badge variant="success">Inmediato</Badge> : <Badge variant="muted">{e.puntoEquilibrioAnios.toLocaleString("es-CO")} años</Badge>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {r.escenarios.filter((e) => e.advertencias.length > 0).map((e) => (
              <div key={e.tipo} className="rounded-md border p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> {e.etiqueta}</p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {e.advertencias.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            ))}
          </div>
          {continuar && continuar.costoRestante > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Terminar costaría aproximadamente {formatoCOP(continuar.costoRestante)} en matrícula, materiales y transporte durante los semestres restantes.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Este análisis es una herramienta educativa basada en supuestos editables (Admin → Parámetros) y no constituye asesoría financiera. Salarios de referencia: Observatorio Laboral para la Educación (MEN).
      </p>
    </section>
  );
}
