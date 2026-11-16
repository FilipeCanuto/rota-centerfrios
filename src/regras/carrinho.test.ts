import { describe, expect, it } from "vitest";
import {
  abrirEmSerie,
  chaveIdempotencia,
  csvParaLancamento,
  emCentavos,
  podeAbrirCarrinho,
  podeDefinirLimite,
  proximaTentativaMin,
  totalCarrinhoCentavos,
  totalItemCentavos,
  validarDesconto,
  type CarrinhoResumo,
} from "./carrinho";

const aberto = (cliente: string, vendedor = "v1"): CarrinhoResumo => ({
  vendedor_id: vendedor,
  cliente_id: cliente,
  estado: "aberto",
});

describe("dinheiro", () => {
  it("arredonda meio-para-cima em centavos", () => {
    expect(emCentavos(0.005)).toBe(1);
    expect(emCentavos(1.004)).toBe(100);
    expect(emCentavos(1.005)).toBe(101); // 1.005 em binário é 1.00499…; o ajuste mantém o meio-para-cima
  });
  it("total do item aplica desconto e arredonda por item", () => {
    expect(totalItemCentavos(10, 3)).toBe(3000);
    expect(totalItemCentavos(33.33, 3, 10)).toBe(8999); // 89,991 → 89,99
    expect(totalItemCentavos(0.1, 3)).toBe(30); // sem erro de ponto flutuante
  });
  it("total do carrinho soma itens já arredondados", () => {
    expect(
      totalCarrinhoCentavos([
        { preco_unit: 0.335, quantidade: 1 },
        { preco_unit: 0.335, quantidade: 1 },
      ]),
    ).toBe(68); // 0,34 + 0,34 (não 0,67)
  });
  it("recusa quantidade e desconto inválidos", () => {
    expect(() => totalItemCentavos(10, 0)).toThrow();
    expect(() => totalItemCentavos(10, 1, 101)).toThrow();
  });
});

describe("limite de carrinhos", () => {
  it("permite até 3 abertos por vendedor", () => {
    const tres = [aberto("a"), aberto("b"), aberto("c")];
    expect(podeAbrirCarrinho(tres.slice(0, 2), "v1", "c", 3)).toEqual({ ok: true });
    expect(podeAbrirCarrinho(tres, "v1", "d", 3)).toEqual({ ok: false, motivo: "limite_vendedor" });
  });
  it("concluídos e cancelados não contam; outro vendedor não conta", () => {
    const lista: CarrinhoResumo[] = [
      { ...aberto("a"), estado: "concluido" },
      { ...aberto("b"), estado: "cancelado" },
      aberto("c", "v2"),
      aberto("d", "v2"),
      aberto("e", "v2"),
    ];
    expect(podeAbrirCarrinho(lista, "v1", "x", 3).ok).toBe(true);
  });
  it("um aberto por cliente por vendedor", () => {
    expect(podeAbrirCarrinho([aberto("a")], "v1", "a", 3)).toEqual({
      ok: false,
      motivo: "cliente_ja_tem_aberto",
    });
    expect(podeAbrirCarrinho([aberto("a", "v2")], "v1", "a", 3).ok).toBe(true);
  });
  it("corrida: 5 cliques simultâneos serializados abrem só até o limite", () => {
    const pedidos = ["a", "b", "c", "d", "e"].map((c) => ({ vendedor_id: "v1", cliente_id: c }));
    const { carrinhos, resultados } = abrirEmSerie([aberto("z")], pedidos, 3);
    expect(carrinhos.filter((c) => c.estado === "aberto")).toHaveLength(3);
    expect(resultados.filter((r) => r.ok)).toHaveLength(2);
  });
  it("corrida: duas abas para o mesmo cliente abrem um só", () => {
    const p = { vendedor_id: "v1", cliente_id: "a" };
    const { resultados } = abrirEmSerie([], [p, p], 3);
    expect(resultados.map((r) => r.ok)).toEqual([true, false]);
  });
});

describe("desconto", () => {
  const agora = "2026-11-16T12:00:00Z";
  const lib = (
    desconto_pct: number,
    estado: "aprovada" | "negada" | "pendente",
    valida_ate: string,
  ) => ({
    desconto_pct,
    estado,
    valida_ate,
  });
  it("até o limite passa sem liberação", () => {
    expect(validarDesconto(5, 5, [], agora).ok).toBe(true);
  });
  it("acima do limite bloqueia sem liberação", () => {
    expect(validarDesconto(5.01, 5, [], agora)).toEqual({ ok: false, motivo: "precisa_liberacao" });
  });
  it("só liberação aprovada, vigente e que cubra o % libera", () => {
    expect(validarDesconto(12, 5, [lib(15, "aprovada", "2026-11-20T00:00:00Z")], agora).ok).toBe(
      true,
    );
    expect(validarDesconto(12, 5, [lib(10, "aprovada", "2026-11-20T00:00:00Z")], agora).ok).toBe(
      false,
    );
    expect(validarDesconto(12, 5, [lib(15, "aprovada", "2026-11-15T00:00:00Z")], agora).ok).toBe(
      false,
    );
    expect(validarDesconto(12, 5, [lib(15, "pendente", "2026-11-20T00:00:00Z")], agora).ok).toBe(
      false,
    );
    expect(validarDesconto(12, 5, [lib(15, "negada", "2026-11-20T00:00:00Z")], agora).ok).toBe(
      false,
    );
  });
  it("supervisor até o teto; diretoria qualquer valor", () => {
    expect(podeDefinirLimite("supervisor", 10, 10)).toBe(true);
    expect(podeDefinirLimite("supervisor", 10.5, 10)).toBe(false);
    expect(podeDefinirLimite("diretoria", 40, 10)).toBe(true);
    expect(podeDefinirLimite("diretoria", 101, 10)).toBe(false);
  });
});

describe("fila de envio", () => {
  it("chave de idempotência é estável por carrinho", () => {
    expect(chaveIdempotencia("abc")).toBe(chaveIdempotencia("abc"));
    expect(chaveIdempotencia("abc")).not.toBe(chaveIdempotencia("abd"));
  });
  it("espera cresce e para em 60 minutos", () => {
    expect([0, 1, 2, 3, 10].map(proximaTentativaMin)).toEqual([1, 2, 4, 8, 60]);
  });
});

describe("CSV para lançamento manual", () => {
  it("uma linha por item, vírgula decimal, data dd/mm/aaaa e aspas quando preciso", () => {
    const csv = csvParaLancamento([
      {
        id: "o1",
        chave_idempotencia: "rota:carrinho:c1",
        cliente_codigo: "10",
        data: "2026-11-16",
        vendedor_email: "clara@centerfrios.com",
        itens: [
          {
            codigo_produto: "P1",
            descricao: 'Freezer 500L; "inox"',
            unidade: "UN",
            quantidade: 2,
            preco_unit: 4599.9,
            desconto_pct: 5,
            total: 8739.81,
          },
        ],
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM: o Excel abre com acentos certos
    const [cab, l1] = csv.slice(1).split("\r\n");
    expect(cab!.split(";")).toHaveLength(11);
    expect(l1).toBe(
      'rota:carrinho:c1;16/11/2026;10;clara@centerfrios.com;P1;"Freezer 500L; ""inox""";UN;2;4599,9;5;8739,81',
    );
  });
});
