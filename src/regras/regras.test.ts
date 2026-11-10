import { describe, expect, it } from "vitest";
import {
  REGRAS_PADRAO as cfg,
  atingimento,
  clienteEsquecido,
  clienteSemCompra,
  cobertura,
  diasUteisDoMes,
  interacaoQualificada,
  metaDoDia,
  orcamentoParado,
  projecao,
  statusRecompra,
} from "./index";

// Novembro/2026: dia 1 é domingo; 21 dias úteis (seg-sex).
const d = (s: string) => {
  const [a, m, dd] = s.split("-").map(Number);
  return new Date(a, m - 1, dd);
};

describe("metas", () => {
  it("novembro/2026 tem 21 dias úteis", () => expect(diasUteisDoMes(d("2026-11-10"))).toBe(21));
  it("atingimento = faturado ÷ meta", () => expect(atingimento(60000, 120000)).toBe(0.5));
  it("atingimento com meta zero é 0", () => expect(atingimento(1000, 0)).toBe(0));
  it("projeção = faturado ÷ dias úteis decorridos × dias úteis do mês", () => {
    // 10/11/2026 (terça): 7 dias úteis decorridos
    expect(projecao(70000, d("2026-11-10"))).toBeCloseTo(210000);
  });
  it("meta do dia = (meta − faturado até ontem) ÷ dias úteis restantes", () => {
    // restantes a partir de 10/11 inclusive: 15
    expect(metaDoDia(120000, 45000, d("2026-11-10"))).toBeCloseTo(5000);
  });
  it("meta do dia nunca é negativa", () => expect(metaDoDia(100, 500, d("2026-11-10"))).toBe(0));
});

describe("cobertura", () => {
  it("mensagem sem resposta não conta como qualificada", () => {
    expect(interacaoQualificada({ tipo: "whatsapp", cliente_respondeu: false, resultado: "enviado" })).toBe(false);
  });
  it("visita ou ligação com resultado conta", () => {
    expect(interacaoQualificada({ tipo: "visita", cliente_respondeu: false, resultado: "pedido" })).toBe(true);
    expect(interacaoQualificada({ tipo: "ligacao", cliente_respondeu: false, resultado: "" })).toBe(false);
  });
  it("compra no mês cobre o cliente", () => {
    const r = cobertura(
      ["a", "b", "c", "d"],
      [
        { cliente_id: "a", tipo: "whatsapp", cliente_respondeu: true, resultado: null },
        { cliente_id: "b", tipo: "whatsapp", cliente_respondeu: false, resultado: null },
      ],
      [{ cliente_id: "c" }],
    );
    expect(r).toEqual({ cobertos: 2, total: 4, percentual: 0.5 });
  });
});

describe("recompra", () => {
  const compras = ["2026-08-01", "2026-08-11", "2026-08-21"]; // intervalo médio 10 dias
  it("exige no mínimo 3 compras", () => {
    expect(statusRecompra(["2026-08-01", "2026-08-11"], d("2026-11-01"), cfg).status).toBe("sem_historico");
  });
  it("em dia abaixo de 1,5x", () => expect(statusRecompra(compras, d("2026-09-04"), cfg).status).toBe("em_dia"));
  it("atenção a partir de 1,5x", () => expect(statusRecompra(compras, d("2026-09-05"), cfg).status).toBe("atencao"));
  it("urgente a partir de 2x", () => expect(statusRecompra(compras, d("2026-09-10"), cfg).status).toBe("urgente"));
});

describe("carteira", () => {
  it("esquecido com 30 dias sem interação qualificada", () => {
    expect(clienteEsquecido("2026-10-11", d("2026-11-10"), cfg)).toBe(true);
    expect(clienteEsquecido("2026-10-12", d("2026-11-10"), cfg)).toBe(false);
  });
  it("sem compra a partir de 90 dias", () => {
    expect(clienteSemCompra("2026-08-12", d("2026-11-10"), cfg)).toBe(true);
    expect(clienteSemCompra("2026-08-13", d("2026-11-10"), cfg)).toBe(false);
  });
  it("orçamento parado após 2 dias úteis sem interação", () => {
    // sexta 06/11 → segunda 09/11 = 1 dia útil; terça 10/11 = 2
    expect(orcamentoParado("2026-11-06", d("2026-11-09"), cfg)).toBe(false);
    expect(orcamentoParado("2026-11-06", d("2026-11-10"), cfg)).toBe(true);
  });
});
