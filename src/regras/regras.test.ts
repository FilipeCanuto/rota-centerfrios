import { describe, expect, it } from "vitest";
import {
  REGRAS_PADRAO as cfg,
  atingimento,
  configuracaoPorEmpresa,
  dataLocal,
  diasUteisDecorridos,
  diasUteisDoMes,
  diasUteisRestantes,
  feriadosDaEmpresa,
  hojeEmMaceio,
  metaDiariaCobertura,
  metaDoDia,
  montarConfiguracao,
  projecao,
} from "./index";

// Feriados nacionais da tabela `feriados` usados nos testes.
const NACIONAIS = new Set(["2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25", "2027-01-01"]);
const SEM: ReadonlySet<string> = new Set();
const d = (s: string) => {
  const [a = 1970, m = 1, dd = 1] = s.split("-").map(Number);
  return new Date(a, m - 1, dd);
};

describe("dias úteis", () => {
  it("novembro/2026 tem 19 dias úteis (Finados e Consciência Negra caem em dia de semana)", () =>
    expect(diasUteisDoMes(d("2026-11-10"), NACIONAIS)).toBe(19));
  it("sem feriados, novembro/2026 teria 21", () =>
    expect(diasUteisDoMes(d("2026-11-10"), SEM)).toBe(21));
  it("feriado no domingo (15/11) não muda a conta", () =>
    expect(diasUteisDoMes(d("2026-11-10"), new Set(["2026-11-15"]))).toBe(21));
  it("decorridos e restantes incluem hoje quando é dia útil", () => {
    // 10/11 (terça): 2 a 10 → 6 úteis (02/11 é feriado); 10 a 30 → 14 úteis (20/11 é feriado)
    expect(diasUteisDecorridos(d("2026-11-10"), NACIONAIS)).toBe(6);
    expect(diasUteisRestantes(d("2026-11-10"), NACIONAIS)).toBe(14);
  });
  it("dia sem expediente da empresa (abrangência empresa) conta igual a feriado", () =>
    expect(diasUteisDoMes(d("2027-02-10"), new Set(["2027-02-08", "2027-02-09"]))).toBe(18));
  it("feriado de uma empresa não vale para a outra", () => {
    const linhas = [
      { data: "2026-11-20", empresa_id: null },
      { data: "2026-11-27", empresa_id: "cf" },
    ];
    expect(feriadosDaEmpresa(linhas, "cf").has("2026-11-27")).toBe(true);
    expect(feriadosDaEmpresa(linhas, "381").has("2026-11-27")).toBe(false);
    expect(feriadosDaEmpresa(linhas, "381").has("2026-11-20")).toBe(true);
  });
});

describe("fuso de Maceió", () => {
  it("contato às 23h30 de Maceió conta no próprio dia, não no seguinte", () =>
    expect(dataLocal("2026-11-11T02:30:00Z")).toBe("2026-11-10"));
  it("00h01 de Maceió já é o dia seguinte", () =>
    expect(dataLocal("2026-11-11T03:01:00Z")).toBe("2026-11-11"));
  it("hoje em Maceió à 00h30 UTC ainda é o dia anterior", () =>
    expect(hojeEmMaceio(new Date("2026-11-11T00:30:00Z")).getDate()).toBe(10));
});

describe("metas", () => {
  it("atingimento = faturado ÷ meta", () => expect(atingimento(60000, 120000)).toBe(0.5));
  it("atingimento com meta zero é 0 (sem divisão por zero)", () =>
    expect(atingimento(1000, 0)).toBe(0));
  it("mês sem vendas: atingimento 0 e projeção 0", () => {
    expect(atingimento(0, 100000)).toBe(0);
    expect(projecao(0, d("2026-11-10"), NACIONAIS)).toBe(0);
  });
  it("atingimento acima de 100%", () => expect(atingimento(150, 100)).toBe(1.5));
  it("projeção = faturado ÷ dias úteis decorridos × dias úteis do mês", () =>
    // 60.000 ÷ 6 × 19
    expect(projecao(60000, d("2026-11-10"), NACIONAIS)).toBeCloseTo(190000));
  it("projeção sem dia útil decorrido (domingo, 1º) devolve o próprio faturado", () =>
    expect(projecao(500, d("2026-11-01"), NACIONAIS)).toBe(500));
  it("meta do dia = (meta − faturado até ontem) ÷ dias úteis restantes", () =>
    // (110.000 − 40.000) ÷ 14
    expect(metaDoDia(110000, 40000, d("2026-11-10"), NACIONAIS)).toBeCloseTo(5000));
  it("meta do dia nunca é negativa", () =>
    expect(metaDoDia(100, 500, d("2026-11-10"), NACIONAIS)).toBe(0));
  it("depois do último dia útil (sábado, 31/10), a meta do dia é tudo o que falta", () =>
    expect(metaDoDia(1000, 400, d("2026-10-31"), NACIONAIS)).toBe(600));
  it("feriado entre hoje e o fim do mês aumenta a meta do dia", () =>
    expect(metaDoDia(1500, 0, d("2026-11-18"), NACIONAIS)).toBeGreaterThan(
      metaDoDia(1500, 0, d("2026-11-18"), SEM),
    ));
  it("meta diária de cobertura = (meta mensal − atingida) ÷ dias úteis restantes", () =>
    // 70% de 18 = 12,6 → 13; faltam 13 − 10 = 3; 3 ÷ 14 → 1
    expect(metaDiariaCobertura(70, 10, 18, d("2026-11-10"), NACIONAIS)).toBe(1));
  it("meta diária de cobertura já atingida é 0; carteira vazia é 0", () => {
    expect(metaDiariaCobertura(70, 15, 18, d("2026-11-10"), NACIONAIS)).toBe(0);
    expect(metaDiariaCobertura(70, 0, 0, d("2026-11-10"), NACIONAIS)).toBe(0);
  });
});

describe("configuração por empresa", () => {
  it("limites vêm da tabela, com reserva para chave ausente", () =>
    expect(
      montarConfiguracao([{ chave: "cliente_esquecido_dias", valor: 45 }]).cliente_esquecido_dias,
    ).toBe(45));
  it("regras de uma empresa não vazam para a outra", () => {
    const m = configuracaoPorEmpresa(
      [
        { empresa_id: "cf", chave: "cliente_esquecido_dias", valor: 30 },
        { empresa_id: "381", chave: "cliente_esquecido_dias", valor: 60 },
      ],
      ["cf", "381"],
    );
    expect(m.get("cf")!.cliente_esquecido_dias).toBe(30);
    expect(m.get("381")!.cliente_esquecido_dias).toBe(60);
    expect(m.get("381")!.recompra_minimo_compras).toBe(cfg.recompra_minimo_compras);
  });
});
