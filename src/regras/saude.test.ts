import { describe, expect, it } from "vitest";
import { REGRAS_PADRAO as cfg, saudeCliente } from "./index";

const d = (s: string) => {
  const [a = 1970, m = 1, dd = 1] = s.split("-").map(Number);
  return new Date(a, m - 1, dd);
};
const hoje = d("2026-11-10");

describe("saúde do cliente", () => {
  it("compra regular e contato recente: saudável", () =>
    expect(
      saudeCliente(
        { compras: ["2026-10-20", "2026-10-30", "2026-11-08"], ultima_interacao_qualificada: null },
        hoje,
        cfg,
      ),
    ).toBe("saudavel"));
  it("nunca comprou: em risco", () =>
    expect(
      saudeCliente({ compras: [], ultima_interacao_qualificada: "2026-11-09" }, hoje, cfg),
    ).toBe("em_risco"));
  it("90 dias ou mais sem compra: em risco", () =>
    expect(
      saudeCliente(
        { compras: ["2026-08-12"], ultima_interacao_qualificada: "2026-11-09" },
        hoje,
        cfg,
      ),
    ).toBe("em_risco"));
  it("recompra urgente (2× o intervalo): em risco", () =>
    expect(
      saudeCliente(
        {
          compras: ["2026-09-01", "2026-09-11", "2026-09-21"],
          ultima_interacao_qualificada: "2026-11-09",
        },
        hoje,
        cfg,
      ),
    ).toBe("em_risco"));
  it("recompra em atenção (1,5×): atenção", () =>
    expect(
      saudeCliente(
        {
          compras: ["2026-10-01", "2026-10-11", "2026-10-21"],
          ultima_interacao_qualificada: "2026-11-09",
        },
        d("2026-11-05"),
        cfg,
      ),
    ).toBe("atencao"));
  it("menos de 3 compras e sem contato há 30 dias: atenção (esquecido)", () =>
    expect(
      saudeCliente(
        { compras: ["2026-09-20", "2026-10-05"], ultima_interacao_qualificada: null },
        hoje,
        cfg,
      ),
    ).toBe("atencao"));
});
