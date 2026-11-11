import { describe, expect, it } from "vitest";
import {
  colunasRepetidas,
  lerCsv,
  lerData,
  lerNumero,
  lerTelefone,
  montarLinhas,
  sugerirMapeamento,
  type LinhaCsv,
} from "./index";

/** Linhas de dados numeradas a partir da 2 (a 1 é o cabeçalho). */
const dados = (...linhas: string[][]): LinhaCsv[] =>
  linhas.map((valores, i) => ({ numero: i + 2, valores }));

describe("leitura de CSV", () => {
  it("separador ponto e vírgula, aspas, BOM e número real da linha", () =>
    expect(lerCsv('﻿Código;Nome\r\n\r\n1;"Padaria ""Pão"";Ltda"\r\n')).toEqual([
      { numero: 1, valores: ["Código", "Nome"] },
      { numero: 3, valores: ["1", 'Padaria "Pão";Ltda'] },
    ]));
  it("quebra de linha dentro de aspas conta para o número das linhas seguintes", () =>
    expect(lerCsv('a,b\n"x\ny",2\nz,3')).toEqual([
      { numero: 1, valores: ["a", "b"] },
      { numero: 2, valores: ["x\ny", "2"] },
      { numero: 4, valores: ["z", "3"] },
    ]));
  it("aspas no meio do campo são texto", () =>
    expect(lerCsv('a;b\nFreezer 20";5\n')[1]!.valores).toEqual(['Freezer 20"', "5"]));
  it("números, datas e telefones", () => {
    expect(lerNumero("R$ 1.234,56")).toBe(1234.56);
    expect(lerNumero("1.234")).toBe(1234);
    expect(lerNumero("1234.5")).toBe(1234.5);
    expect(lerNumero("abc")).toBeNull();
    expect(lerData("09/11/2026")).toBe("2026-11-09");
    expect(lerData("31/02/2026")).toBeNull();
    expect(lerData("2026-11-09")).toBe("2026-11-09");
    expect(lerTelefone("(082) 99999-0000")).toBe("5582999990000");
    expect(lerTelefone("+55 82 3333-0000")).toBe("558233330000");
    expect(lerTelefone("99999-0000")).toBeNull();
    expect(lerTelefone("")).toBe("");
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
  it("aponta campos que usam a mesma coluna", () =>
    expect(
      colunasRepetidas("orcamentos", {
        codigo_shop9: 0,
        cliente_codigo: 0,
        data: 1,
        valor: 2,
        status: 3,
      }),
    ).toEqual(["Código do cliente"]));
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
  it("clientes: normaliza telefone e documento, recusa vazios, repetidos, telefone e vendedor inválidos", () => {
    const r = montarLinhas(
      "clientes",
      dados(
        ["10", "Padaria A", "(82) 99999-0000", "12.345.678/0001-90", "Clara@centerfrios.com"],
        ["11", "", "", "", "clara@centerfrios.com"],
        ["10", "Padaria A de novo", "", "", "clara@centerfrios.com"],
        ["12", "Padaria B", "9999", "", "clara@centerfrios.com"],
        ["13", "Padaria C", "", "", "Clara"],
      ),
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
      [5, "telefone"],
      [6, "vendedor_email"],
    ]);
  });
  const mapaVen = {
    codigo_shop9: 0,
    cliente_codigo: 1,
    data_faturamento: 2,
    valor: -1,
    produto: 3,
    codigo_produto: -1,
    quantidade: 4,
    valor_item: 5,
  };
  it("vendas: agrupa uma linha por item na mesma nota e soma o valor quando não vem", () => {
    const r = montarLinhas(
      "vendas",
      dados(
        ["NF1", "10", "09/11/2026", "Freezer", "1", "3.000,00"],
        ["NF1", "10", "09/11/2026", "Gelo", "5", "50"],
      ),
      mapaVen,
    );
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({
      codigo_shop9: "NF1",
      data_faturamento: "2026-11-09",
      valor: 3050,
    });
    expect((r.linhas[0]!["itens"] as unknown[]).length).toBe(2);
    expect(r.erros).toEqual([]);
  });
  it("vendas: uma linha com erro tira a nota inteira (sem gravar só parte dos itens)", () => {
    const r = montarLinhas(
      "vendas",
      dados(
        ["NF1", "10", "09/11/2026", "Freezer", "1", "3000"],
        ["NF1", "10", "09/11/2026", "Gelo", "cinco", "50"],
        ["NF2", "10", "09/11/2026", "Balcão", "1", "900"],
        ["NF2", "11", "09/11/2026", "Outro", "1", "1"],
        ["NF3", "10", "09/11/2026", "Forno", "1", "500"],
      ),
      mapaVen,
    );
    expect(r.linhas.map((l) => l["codigo_shop9"])).toEqual(["NF3"]);
    expect(r.erros.map((e) => [e.linha, e.campo])).toEqual([
      [2, "codigo_shop9"],
      [3, "quantidade"],
      [4, "codigo_shop9"],
      [5, "codigo_shop9"],
    ]);
  });
  it("vendas: sem valor da nota e sem valor dos itens é erro", () => {
    const mapa = { ...mapaVen, quantidade: -1, valor_item: -1 };
    expect(
      montarLinhas("vendas", dados(["NF9", "10", "09/11/2026", "Freezer"]), mapa).erros[0]!.campo,
    ).toBe("valor");
  });
  it("orçamentos: situação reconhecida e valor obrigatório", () => {
    const mapa = { codigo_shop9: 0, cliente_codigo: 1, data: 2, valor: 3, status: 4 };
    const r = montarLinhas(
      "orcamentos",
      dados(
        ["O1", "10", "08/11/2026", "900", "Fechado"],
        ["O2", "10", "08/11/2026", "-5", "aberto"],
        ["O3", "10", "08/11/2026", "10", "talvez"],
      ),
      mapa,
    );
    expect(r.linhas.map((l) => l["status"])).toEqual(["ganho"]);
    expect(r.erros.map((e) => e.campo)).toEqual(["valor", "status"]);
  });
});
