import { describe, expect, it, vi } from "vitest";
import { memorizar, sinVacios } from "@/lib/utils";

describe("utilidades", () => {
  it("memorizar llama a la función una sola vez por valor", () => {
    const fn = vi.fn((x: string) => x.toUpperCase());
    const m = memorizar(fn);
    expect([m("a"), m("b"), m("a"), m("a")]).toEqual(["A", "B", "A", "A"]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("sinVacios quita los parámetros vacíos o ausentes", () => {
    expect(sinVacios([["q", "ana"], ["programa", ""], ["nivel", undefined]])).toEqual({ q: "ana" });
    expect(sinVacios(new URLSearchParams("q=&nivel=ALTO"))).toEqual({ nivel: "ALTO" });
  });
});
