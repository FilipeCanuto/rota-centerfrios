import { describe, expect, it } from "vitest";
import {
  REGRAS_PADRAO as cfg,
  avaliarCliente,
  calcularPainel,
  clienteEsquecido,
  clienteSemCompra,
  cobertura,
  interacaoQualificada,
  intervaloMedioCompras,
  orcamentoParado,
  reativado,
  statusRecompra,
  ultimaInteracaoQualificada,
  type ClienteBanco,
  type PainelBanco,
} from "./index";

const NACIONAIS = new Set(["2026-11-02", "2026-11-15", "2026-11-20"]);
const d = (s: string) => {
  const [a = 1970, m = 1, dd = 1] = s.split("-").map(Number);
  return new Date(a, m - 1, dd);
};
const cliente = (p: Partial<ClienteBanco> = {}): ClienteBanco => ({
  id: "c1",
  nome: "Padaria Teste",
  telefone: null,
  segmento: null,
  cidade: null,
  empresa_id: "cf",
  data_ultima_compra: null,
  compras: [],
  comprou_no_mes: false,
  ultima_interacao: null,
  ultima_interacao_qualificada: null,
  qualificada_hoje: false,
  qualificada_no_mes: false,
  orcamentos_abertos: [],
  ...p,
});

describe("interação qualificada e cobertura", () => {
  it("mensagem sem resposta não conta", () =>
    expect(
      interacaoQualificada({ tipo: "whatsapp", cliente_respondeu: false, resultado: "enviado" }),
    ).toBe(false));
  it("visita ou ligação com resultado conta; resultado em branco não", () => {
    expect(
      interacaoQualificada({ tipo: "visita", cliente_respondeu: false, resultado: "pedido" }),
    ).toBe(true);
    expect(
      interacaoQualificada({ tipo: "ligacao", cliente_respondeu: false, resultado: "   " }),
    ).toBe(false);
  });
  it("compra conta como interação qualificada", () => {
    expect(ultimaInteracaoQualificada("2026-09-01", "2026-11-09")).toBe("2026-11-09");
    expect(ultimaInteracaoQualificada(null, null)).toBeNull();
  });
  it("cobertura conta compra ou interação qualificada, cada cliente uma vez", () =>
    expect(
      cobertura([
        { comprou_no_mes: true, qualificada_no_mes: true },
        { comprou_no_mes: false, qualificada_no_mes: true },
        { comprou_no_mes: false, qualificada_no_mes: false },
        { comprou_no_mes: false, qualificada_no_mes: false },
      ]),
    ).toEqual({ cobertos: 2, total: 4, percentual: 0.5 }));
  it("carteira vazia: cobertura 0, sem divisão por zero", () =>
    expect(cobertura([])).toEqual({ cobertos: 0, total: 0, percentual: 0 }));
});

describe("recompra", () => {
  const compras = ["2026-08-01", "2026-08-11", "2026-08-21"]; // intervalo médio 10 dias
  it("menos de 3 compras: sem histórico", () =>
    expect(statusRecompra(["2026-08-01", "2026-08-11"], d("2026-11-01"), cfg).status).toBe(
      "sem_historico",
    ));
  it("3 compras no mesmo dia contam como uma: sem histórico", () =>
    expect(intervaloMedioCompras(["2026-08-01", "2026-08-01", "2026-08-01"], 3)).toBeNull());
  it("em dia abaixo de 1,5×", () =>
    expect(statusRecompra(compras, d("2026-09-04"), cfg).status).toBe("em_dia"));
  it("atenção a partir de 1,5×", () =>
    expect(statusRecompra(compras, d("2026-09-05"), cfg).status).toBe("atencao"));
  it("urgente a partir de 2×", () =>
    expect(statusRecompra(compras, d("2026-09-10"), cfg).status).toBe("urgente"));
  it("os fatores vêm da configuração", () =>
    expect(
      statusRecompra(compras, d("2026-09-05"), {
        ...cfg,
        recompra_fator_atencao: 2,
        recompra_fator_urgente: 3,
      }).status,
    ).toBe("em_dia"));
});

describe("carteira", () => {
  it("esquecido com 30 dias ou mais sem interação qualificada; nunca contatado também", () => {
    expect(clienteEsquecido("2026-10-11", d("2026-11-10"), cfg)).toBe(true);
    expect(clienteEsquecido("2026-10-12", d("2026-11-10"), cfg)).toBe(false);
    expect(clienteEsquecido(null, d("2026-11-10"), cfg)).toBe(true);
  });
  it("sem compra a partir de 90 dias; nunca comprou também", () => {
    expect(clienteSemCompra("2026-08-12", d("2026-11-10"), cfg)).toBe(true);
    expect(clienteSemCompra("2026-08-13", d("2026-11-10"), cfg)).toBe(false);
    expect(clienteSemCompra(null, d("2026-11-10"), cfg)).toBe(true);
  });
  it("orçamento parado após 2 dias úteis sem interação", () => {
    // sexta 06/11 → segunda 09/11 = 1 dia útil; terça 10/11 = 2
    expect(orcamentoParado("2026-11-06", d("2026-11-09"), cfg, NACIONAIS)).toBe(false);
    expect(orcamentoParado("2026-11-06", d("2026-11-10"), cfg, NACIONAIS)).toBe(true);
  });
  it("feriado no meio não conta como dia útil no orçamento parado", () => {
    // quinta 19/11 → sexta 20/11 (feriado) → segunda 23/11 = 1 dia útil
    expect(orcamentoParado("2026-11-19", d("2026-11-23"), cfg, NACIONAIS)).toBe(false);
    expect(orcamentoParado("2026-11-19", d("2026-11-24"), cfg, NACIONAIS)).toBe(true);
  });
  it("interação no mesmo dia não deixa o orçamento parado", () =>
    expect(orcamentoParado("2026-11-10", d("2026-11-10"), cfg, NACIONAIS)).toBe(false));
});

describe("plano do dia e painel", () => {
  const hoje = d("2026-11-10");
  it("cliente que comprou ontem sem interação registrada não aparece como esquecido", () => {
    const c = cliente({
      compras: ["2026-11-09", "2026-10-20", "2026-10-01"],
      comprou_no_mes: true,
    });
    const a = avaliarCliente(c, hoje, cfg, NACIONAIS);
    expect(a.item).toBeNull();
    expect(a.alertas.some((x) => x.tipo === "esquecido")).toBe(false);
  });
  it("cliente que nunca comprou entra como reativar", () =>
    expect(avaliarCliente(cliente(), hoje, cfg, NACIONAIS).item?.tipo).toBe("sem_compra"));
  it("quem já teve contato qualificado hoje sai do plano, mas o alerta continua", () => {
    const c = cliente({
      compras: ["2026-08-01", "2026-08-11", "2026-08-21"],
      qualificada_hoje: true,
      ultima_interacao_qualificada: "2026-11-10",
    });
    const a = avaliarCliente(c, hoje, cfg, NACIONAIS);
    expect(a.item).toBeNull();
    expect(a.alertas.map((x) => x.tipo)).toContain("recompra_urgente");
  });
  it("orçamento parado respeita feriados da empresa", () => {
    const c = cliente({
      compras: ["2026-11-05", "2026-10-20", "2026-10-05"],
      ultima_interacao_qualificada: "2026-11-05",
      orcamentos_abertos: [{ id: "o1", valor: 1000, data: "2026-11-19", ultimo_followup: null }],
    });
    expect(avaliarCliente(c, d("2026-11-23"), cfg, NACIONAIS).orcamentosParados).toBe(0);
    expect(avaliarCliente(c, d("2026-11-23"), cfg, new Set()).orcamentosParados).toBe(1);
  });
  it("reativado: comprou no mês depois de 90 dias ou mais sem comprar", () => {
    expect(
      reativado({ compras: ["2026-11-05", "2026-07-01"], comprou_no_mes: true }, hoje, cfg),
    ).toBe(true);
    expect(
      reativado({ compras: ["2026-11-05", "2026-10-01"], comprou_no_mes: true }, hoje, cfg),
    ).toBe(false);
  });

  const banco = (p: Partial<PainelBanco> = {}): PainelBanco => ({
    faturado_mes: 0,
    faturado_hoje: 0,
    meta: null,
    orcamentos_mes: 0,
    orcamentos_hoje: 0,
    pontos_hoje: 0,
    clientes: [],
    ...p,
  });
  it("mês sem vendas e sem meta: tudo zero, sem erro", () => {
    const p = calcularPainel({
      hoje,
      feriadosGerais: NACIONAIS,
      empresas: [{ cfg, feriados: NACIONAIS, dados: banco() }],
    });
    expect(p.atingimento).toBe(0);
    expect(p.projecao).toBe(0);
    expect(p.cobertura.percentual).toBe(0);
    expect(p.diasUteisMes).toBe(19);
  });
  it("duas empresas: somas dos totais e regras de cada empresa nos clientes", () => {
    const meta = {
      meta_vendas: 50000,
      meta_orcamentos: 10,
      meta_cobertura: 70,
      meta_reativacao: 1,
    };
    const esquecidoHa40 = {
      compras: ["2026-11-01", "2026-10-15", "2026-10-01"],
      ultima_interacao_qualificada: "2026-10-01",
    };
    const p = calcularPainel({
      hoje,
      feriadosGerais: NACIONAIS,
      empresas: [
        {
          cfg,
          feriados: NACIONAIS,
          dados: banco({
            faturado_mes: 30000,
            meta,
            clientes: [cliente({ id: "a", ...esquecidoHa40 })],
          }),
        },
        {
          cfg: { ...cfg, cliente_esquecido_dias: 60 },
          feriados: NACIONAIS,
          dados: banco({
            faturado_mes: 10000,
            meta,
            clientes: [cliente({ id: "b", empresa_id: "381", ...esquecidoHa40 })],
          }),
        },
      ],
    });
    expect(p.faturadoMes).toBe(40000);
    expect(p.meta.meta_vendas).toBe(100000);
    expect(p.atingimento).toBe(0.4);
    // 9 dias sem compra (01/11): com compra recente não é esquecido em nenhuma empresa
    expect(p.alertas.filter((a) => a.tipo === "esquecido")).toHaveLength(0);
  });
});
