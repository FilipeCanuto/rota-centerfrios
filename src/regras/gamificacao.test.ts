import { describe, expect, it } from "vitest";
import { legendaValida, periodoMes, periodoSemana } from "./index";

describe("gamificação", () => {
  it("mês vai do dia 1º ao último", () => {
    expect(periodoMes("2026-02-10")).toEqual(["2026-02-01", "2026-02-28"]);
  });
  it("semana vai de segunda a domingo (quarta, sábado e domingo)", () => {
    expect(periodoSemana("2026-11-11")).toEqual(["2026-11-09", "2026-11-15"]);
    expect(periodoSemana("2026-11-14")).toEqual(["2026-11-09", "2026-11-15"]);
    expect(periodoSemana("2026-11-15")).toEqual(["2026-11-09", "2026-11-15"]);
  });
  it("legenda vale com a menção, sem diferenciar maiúsculas", () => {
    expect(legendaValida("Olha só @CenterfriosOficial", "")).toBe(true);
    expect(legendaValida("sem menção", "")).toBe(false);
  });
  it("hashtag vazia nunca valida; preenchida valida", () => {
    expect(legendaValida("qualquer texto", "")).toBe(false);
    expect(legendaValida("vem #Verao2027", "#verao2027")).toBe(true);
  });
});
