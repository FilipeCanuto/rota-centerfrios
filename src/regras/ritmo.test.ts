import { describe, expect, it } from "vitest";
import { paraData } from "./datas";
import { calcularRitmo } from "./ritmo";

// Nov/2026: 21 dias úteis sem feriado; com 2 e 20/11 de feriado, 19.
const nenhum = new Set<string>();
const feriados = new Set(["2026-11-02", "2026-11-20"]);
const r = (faturado: number, dia: string, f = nenhum) =>
  calcularRitmo({ faturado, meta: 100000, hoje: paraData(dia), feriados: f });

describe("calcularRitmo", () => {
  it("ritmo = dias úteis decorridos / total", () => {
    const x = r(30000, "2026-11-10", feriados); // úteis até 10/11: 3,4,5,6,9,10 = 6 de 19; restantes incluem hoje
    expect(x.ritmo).toBeCloseTo(6 / 19);
    expect(x.restantes).toBe(14);
    expect(x.projecao).toBeCloseTo((30000 / 6) * 19);
  });
  it("feriado muda o ritmo", () => {
    expect(r(0, "2026-11-10").ritmo).not.toBeCloseTo(r(0, "2026-11-10", feriados).ritmo);
  });
  it("status: abaixo, no ritmo e meta batida", () => {
    expect(r(10000, "2026-11-10", feriados).status).toBe("abaixo");
    expect(r(40000, "2026-11-10", feriados).status).toBe("no_ritmo");
    expect(r(100000, "2026-11-10", feriados).status).toBe("batida");
  });
  it("ritmo necessário por dia útil restante", () => {
    const x = r(30000, "2026-11-10", feriados);
    expect(x.falta).toBe(70000);
    expect(x.ritmoNecessario).toBeCloseTo(70000 / 14);
  });
  it("mês concluído: sem dias restantes nem ritmo necessário", () => {
    const x = r(80000, "2026-11-30", feriados); // 30/11 é segunda: ainda há 1 dia
    expect(x.restantes).toBe(1);
    const fim = calcularRitmo({
      faturado: 80000,
      meta: 100000,
      hoje: paraData("2026-12-01"),
      feriados: new Set([
        "2026-12-01",
        "2026-12-02",
        "2026-12-03",
        "2026-12-04",
        "2026-12-07",
        "2026-12-08",
        "2026-12-09",
        "2026-12-10",
        "2026-12-11",
        "2026-12-14",
        "2026-12-15",
        "2026-12-16",
        "2026-12-17",
        "2026-12-18",
        "2026-12-21",
        "2026-12-22",
        "2026-12-23",
        "2026-12-24",
        "2026-12-25",
        "2026-12-28",
        "2026-12-29",
        "2026-12-30",
        "2026-12-31",
      ]),
    });
    expect(fim.concluido).toBe(true);
    expect(fim.ritmoNecessario).toBe(0);
  });
  it("meta zero não quebra", () => {
    const x = r(0, "2026-11-10");
    expect(
      calcularRitmo({ faturado: 5, meta: 0, hoje: paraData("2026-11-10"), feriados: nenhum })
        .atingido,
    ).toBe(0);
    expect(x.projecaoPct).toBe(0);
  });
});
