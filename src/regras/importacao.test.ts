import { describe, expect, it } from "vitest";
import { lerCsv, lerData, lerNumero, montarLinhas, sugerirMapeamento } from "./index";

describe("leitura de CSV", () => {
  it("separador ponto e vírgula, aspas e BOM", () =>
    expect(lerCsv('﻿Código;Nome\r\n1;"Padaria ""Pão"";Ltda"\r\n\r\n')).toEqual([
      ["Código", "Nome"],
      ["1", 'Padaria "Pão";Ltda'],
    ]));
  it("separador vírgula e quebra de linha dentro de aspas", () =>
    expect(lerCsv('a,b\n"x\ny",2')).toEqual([
      ["a", "b"],
      ["x\ny", "2"],
    ]));
  it("números e datas no formato brasileiro", () => {
    expect(lerNumero("R$ 1.234,56")).toBe(1234.56);
    expect(lerNumero("1234.5")).toBe(1234.5);
    expect(lerNumero("abc")).toBeNull();
    expect(lerData("09/11/2026")).toBe("2026-11-09");
    expect(lerData("31/02/2026")).toBeNull();
    expect(lerData("2026-11-09")).toBe("2026-11-09");
  });
});

describe("mapeamento", () => {
  it("sugere pelas colunas do Shop9, sem acento e sem repetir coluna", () => {
    const m = sugerirMapeamento("clientes", [
      "Cód. Cliente",
      "Razão Social",
      "Celular",
      "E-mail Vendedor",
    ]);
    expect(m).toMatchObject({
      codigo_shop9: 0,
      nome: 1,
      telefone: 2,
      vendedor_email: 3,
      cidade: -1,
    });
  });
});

describe("montar linhas", () => {
  const mapaCli = {
    codigo_shop9: 0,
    nome: 1,
    telefone: 2,
    documento: 3,
    email: -1,
    segmento: -1,
    cidade: -1,
    vendedor_email: 4,
  };
  it("clientes: normaliza telefone e documento, recusa vazios e repetidos com o número da linha", () => {
    const r = montarLinhas(
      "clientes",
      [
        ["10", "Padaria A", "(82) 99999-0000", "12.345.678/0001-90", "Clara@centerfrios.com"],
        ["11", "", "", "", "clara@centerfrios.com"],
        ["10", "Padaria A de novo", "", "", "clara@centerfrios.com"],
      ],
      mapaCli,
    );
    expect(r.linhas).toEqual([
      expect.objectContaining({
        linha: 2,
        telefone: "5582999990000",
        documento: "12345678000190",
        vendedor_email: "clara@centerfrios.com",
      }),
    ]);
    expect(r.erros.map((e) => [e.linha, e.campo])).toEqual([
      [3, "nome"],
      [4, "codigo_shop9"],
    ]);
  });
  it("vendas: agrupa uma linha por item na mesma nota e soma o valor quando não vem", () => {
    const mapa = {
      codigo_shop9: 0,
      cliente_codigo: 1,
      data_faturamento: 2,
      valor: -1,
      produto: 3,
      codigo_produto: -1,
      quantidade: 4,
      valor_item: 5,
    };
    const r = montarLinhas(
      "vendas",
      [
        ["NF1", "10", "09/11/2026", "Freezer", "1", "3.000,00"],
        ["NF1", "10", "09/11/2026", "Gelo", "5", "50"],
        ["NF2", "10", "32/11/2026", "x", "1", "1"],
        ["NF1", "11", "09/11/2026", "Outro", "1", "1"],
      ],
      mapa,
    );
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({
      codigo_shop9: "NF1",
      data_faturamento: "2026-11-09",
      valor: 3050,
    });
    expect((r.linhas[0]!.itens as unknown[]).length).toBe(2);
    expect(r.erros.map((e) => e.linha)).toEqual([4, 5]);
  });
  it("vendas: sem valor e sem itens é erro", () => {
    const mapa = {
      codigo_shop9: 0,
      cliente_codigo: 1,
      data_faturamento: 2,
      valor: -1,
      produto: -1,
      codigo_produto: -1,
      quantidade: -1,
      valor_item: -1,
    };
    expect(montarLinhas("vendas", [["NF9", "10", "09/11/2026"]], mapa).erros[0]!.campo).toBe(
      "valor",
    );
  });
  it("orçamentos: situação reconhecida e valor obrigatório", () => {
    const mapa = { codigo_shop9: 0, cliente_codigo: 1, data: 2, valor: 3, status: 4 };
    const r = montarLinhas(
      "orcamentos",
      [
        ["O1", "10", "08/11/2026", "900", "Fechado"],
        ["O2", "10", "08/11/2026", "-5", "aberto"],
        ["O3", "10", "08/11/2026", "10", "talvez"],
      ],
      mapa,
    );
    expect(r.linhas.map((l) => l.status)).toEqual(["ganho"]);
    expect(r.erros.map((e) => e.campo)).toEqual(["valor", "status"]);
  });
});
