import type { CategoriaParametro } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErrorApi } from "@/lib/api";
import type { ActualizarParametros } from "@/lib/validators/parametros";
import type { ParametrosCalculadora } from "@/services/impacto/tipos";
import {
  construirParametrosCalculadora,
  construirReferenciasSpadies,
  type MapaParametros,
  type ReferenciasSpadies,
} from "./conversores";

export interface ParametroDTO {
  id: string;
  categoria: CategoriaParametro;
  clave: string;
  nombre: string;
  valor: number;
  unidad: string;
  descripcion: string | null;
  fuente: string | null;
  programaId: string | null;
  programaNombre: string | null;
  actualizadoEn: string;
}

/** Parámetros que se usan como divisores o duraciones: un 0 rompería los cálculos */
const CLAVES_POSITIVAS = new Set(["meses_por_semestre", "meses_pago_anio", "nocturna_factor_duracion", "salario_bachiller_mensual", "smmlv"]);

/** Acceso y edición de los parámetros económicos (salarios OLE, costos, SPADIES, escenarios) */
export class ServicioParametros {
  async listar(): Promise<ParametroDTO[]> {
    const filas = await prisma.parametroEconomico.findMany({
      include: { programa: { select: { nombre: true } } },
      orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    });
    return filas.map((p) => ({
      id: p.id,
      categoria: p.categoria,
      clave: p.clave,
      nombre: p.nombre,
      valor: p.valor,
      unidad: p.unidad,
      descripcion: p.descripcion,
      fuente: p.fuente,
      programaId: p.programaId,
      programaNombre: p.programa?.nombre ?? null,
      actualizadoEn: p.actualizadoEn.toISOString(),
    }));
  }

  async actualizar(entrada: ActualizarParametros, usuarioId: string): Promise<{ actualizados: number }> {
    const ids = entrada.cambios.map((c) => c.id);
    const existentes = await prisma.parametroEconomico.findMany({ where: { id: { in: ids } }, select: { id: true, unidad: true, clave: true } });
    if (existentes.length !== new Set(ids).size) throw new ErrorApi(404, "Alguno de los parámetros no existe.");

    for (const cambio of entrada.cambios) {
      const p = existentes.find((e) => e.id === cambio.id)!;
      if (p.unidad === "%" && cambio.valor > 100) throw new ErrorApi(400, `El parámetro "${p.clave}" es un porcentaje y no puede superar 100.`);
      if (CLAVES_POSITIVAS.has(p.clave) && cambio.valor <= 0) throw new ErrorApi(400, `El parámetro "${p.clave}" debe ser mayor que cero.`);
    }

    await prisma.$transaction(
      entrada.cambios.map((c) =>
        prisma.parametroEconomico.update({ where: { id: c.id }, data: { valor: c.valor, actualizadoPorId: usuarioId } }),
      ),
    );
    return { actualizados: entrada.cambios.length };
  }

  /**
   * Mapa clave -> valor. Los parámetros específicos de un programa
   * (por ejemplo su salario de enganche) sobrescriben al valor global.
   */
  async mapa(programaId?: string | null): Promise<MapaParametros> {
    const filas = await prisma.parametroEconomico.findMany({
      where: programaId ? { OR: [{ programaId: null }, { programaId }] } : { programaId: null },
      select: { clave: true, valor: true, programaId: true },
    });
    const mapa: MapaParametros = {};
    for (const f of filas.filter((x) => x.programaId === null)) mapa[f.clave] = f.valor;
    for (const f of filas.filter((x) => x.programaId !== null)) mapa[f.clave] = f.valor;
    return mapa;
  }

  async paraCalculadora(programaId?: string | null): Promise<{ parametros: ParametrosCalculadora; mapa: MapaParametros }> {
    const mapa = await this.mapa(programaId);
    return { parametros: construirParametrosCalculadora(mapa), mapa };
  }

  async referenciasSpadies(): Promise<ReferenciasSpadies> {
    return construirReferenciasSpadies(await this.mapa());
  }
}
