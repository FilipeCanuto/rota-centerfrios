import { describe, expect, it } from "vitest";
import {
  REGRAS_PADRAO as cfg,
  dataPrevistaRecompra,
  gradeDoMes,
  inicioSemana,
  somarMeses,
  tiposDoDia,
} from "./index";

describe("calendário", () => {
  it("grade de novembro/2026 vai de segunda a domingo, em semanas completas", () => {
    const g = gradeDoMes("2026-11-11");
    expect(g[0]).toBe("2026-10-26");
    expect(g.at(-1)).toBe("2026-12-06");
    expect(g.length % 7).toBe(0);
  });
  it("mês que começa na segunda e termina no domingo tem 4 semanas (fev/2027)", () => {
    expect(gradeDoMes("2027-02-10")).toHaveLength(28);
  });
  it("início da semana é segunda (domingo volta 6 dias)", () => {
    expect(inicioSemana("2026-11-15")).toBe("2026-11-09");
    expect(inicioSemana("2026-11-09")).toBe("2026-11-09");
  });
  it("somar meses ajusta o fim do mês e vira o ano", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2026-12-15", 1)).toBe("2027-01-15");
    expect(somarMeses("2026-01-15", -1)).toBe("2025-12-15");
  });
  it("tipos do dia saem em ordem fixa e sem repetir", () => {
    const e = (tipo: "retorno" | "feriado") => ({ id: tipo, dia: "d", tipo, titulo: "" });
    expect(tiposDoDia([e("retorno"), e("feriado"), e("retorno")])).toEqual(["feriado", "retorno"]);
  });
  it("recompra prevista = última compra + intervalo médio; sem histórico, nula", () => {
    expect(dataPrevistaRecompra(["2026-01-01", "2026-01-31", "2026-03-02"], cfg)).toBe(
      "2026-04-01",
    );
    expect(dataPrevistaRecompra(["2026-01-01"], cfg)).toBeNull();
  });
});
