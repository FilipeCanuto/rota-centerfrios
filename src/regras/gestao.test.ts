import { describe, expect, it } from "vitest";
import {
  REGRAS_PADRAO as cfg,
  paraData,
  resumirVendedor,
  somarEquipe,
  type LinhaGestao,
} from "./index";

const hoje = paraData("2026-11-11");
const linha = (p: Partial<LinhaGestao> = {}): LinhaGestao => ({
  vendedor_id: "v1",
  nome: "Clara",
  equipe: "Loja",
  meta: { meta_vendas: 100000, meta_cobertura: 70 },
  faturado_mes: 40000,
  faturado_hoje: 1000,
  clientes_total: 50,
  clientes_cobertos: 20,
  orcamentos_abertos: [],
  clientes_sem_compra_90: 4,
  esquecidos: 6,
  ...p,
});

describe("gestão", () => {
  it("atingimento e cobertura", () => {
    const r = resumirVendedor(linha(), hoje, cfg, new Set());
    expect(r.atingimento).toBe(0.4);
    expect(r.cobertura).toBe(0.4);
    expect(r.esperado).toBeGreaterThan(0);
  });
  it("sem meta e sem carteira não inventam percentual", () => {
    const r = resumirVendedor(linha({ meta: null, clientes_total: 0 }), hoje, cfg, new Set());
    expect([r.atingimento, r.esperado, r.cobertura]).toEqual([null, null, null]);
  });
  it("orçamento parado considera o último contato com o cliente", () => {
    const o = { id: "o", valor: 1, data: "2026-11-02", ultimo_followup: null };
    const parado = resumirVendedor(
      linha({ orcamentos_abertos: [{ ...o, ultima_interacao: null }] }),
      hoje,
      cfg,
      new Set(),
    );
    const contatado = resumirVendedor(
      linha({ orcamentos_abertos: [{ ...o, ultima_interacao: "2026-11-10" }] }),
      hoje,
      cfg,
      new Set(),
    );
    expect([parado.orcamentosParados, contatado.orcamentosParados]).toEqual([1, 0]);
  });
  it("equipe soma metas e faturado antes de dividir", () => {
    const t = somarEquipe([
      linha(),
      linha({
        vendedor_id: "v2",
        meta: { meta_vendas: 300000, meta_cobertura: 70 },
        faturado_mes: 60000,
      }),
    ]);
    expect(t.atingimento).toBe(0.25);
    expect(t.clientesSemCompra).toBe(8);
  });
});
