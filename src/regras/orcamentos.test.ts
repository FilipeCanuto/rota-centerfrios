import { describe, expect, it } from "vitest";
import { REGRAS_PADRAO as cfg, paraData, situacaoOrcamento } from "./index";

const hojeISO = "2026-11-11";
const hoje = paraData(hojeISO);
const o = (p: Partial<Parameters<typeof situacaoOrcamento>[0]> = {}) => ({
  status: "aberto",
  data: "2026-11-02",
  ultimo_followup: null,
  proximo_followup: null,
  ...p,
});
const sit = (p = {}) => situacaoOrcamento(o(p), hojeISO, hoje, cfg, new Set());

describe("situacaoOrcamento", () => {
  it("aberto sem retorno há dias úteis está parado", () => {
    expect(sit().parado).toBe(true);
  });
  it("retorno de ontem tira o orçamento de parado", () => {
    expect(sit({ ultimo_followup: "2026-11-10" }).parado).toBe(false);
  });
  it("próximo retorno vencido é retorno atrasado; de hoje não", () => {
    expect(sit({ proximo_followup: "2026-11-10" }).retornoAtrasado).toBe(true);
    expect(sit({ proximo_followup: hojeISO }).retornoAtrasado).toBe(false);
  });
  it("ganho e perdido nunca ficam parados nem atrasados", () => {
    expect(sit({ status: "ganho", proximo_followup: "2026-11-01" })).toEqual({
      parado: false,
      retornoAtrasado: false,
    });
  });
});
