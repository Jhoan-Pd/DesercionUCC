import { describe, expect, it } from "vitest";
import { ESTADO_LIMPIO, MAX_INTENTOS, MINUTOS_BLOQUEO, consultarBloqueo, registrarFallo } from "@/lib/seguridad/bloqueo";

const t0 = new Date("2026-10-09T10:00:00-05:00");
const mas = (min: number) => new Date(t0.getTime() + min * 60_000);

describe("bloqueo por intentos fallidos", () => {
  it("no bloquea antes del quinto intento", () => {
    let e = ESTADO_LIMPIO;
    for (let i = 1; i < MAX_INTENTOS; i++) e = registrarFallo(e, t0);
    expect(e.intentosFallidos).toBe(MAX_INTENTOS - 1);
    expect(consultarBloqueo(e, t0).bloqueado).toBe(false);
  });

  it("bloquea 15 minutos al quinto intento", () => {
    let e = ESTADO_LIMPIO;
    for (let i = 0; i < MAX_INTENTOS; i++) e = registrarFallo(e, t0);
    const c = consultarBloqueo(e, mas(1));
    expect(c.bloqueado).toBe(true);
    expect(c.minutosRestantes).toBe(MINUTOS_BLOQUEO - 1);
  });

  it("el bloqueo vence solo y el conteo vuelve a empezar", () => {
    let e = ESTADO_LIMPIO;
    for (let i = 0; i < MAX_INTENTOS; i++) e = registrarFallo(e, t0);
    expect(consultarBloqueo(e, mas(MINUTOS_BLOQUEO + 1)).bloqueado).toBe(false);
    e = registrarFallo(e, mas(MINUTOS_BLOQUEO + 1));
    expect(e.intentosFallidos).toBe(1);
    expect(e.bloqueadoHasta).toBeNull();
  });

  it("sin fecha de bloqueo la cuenta está libre", () => {
    expect(consultarBloqueo({ intentosFallidos: 3, bloqueadoHasta: null }, t0)).toEqual({ bloqueado: false, minutosRestantes: 0 });
  });
});
