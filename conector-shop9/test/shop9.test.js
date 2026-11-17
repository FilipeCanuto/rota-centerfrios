import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { criarAdaptadorShop9, janelas } from "../src/shop9/adaptador.js";
import { assinarShop9, criarClienteShop9, ErroShop9 } from "../src/shop9/cliente.js";
import { devolucao, dividirVenda, venda } from "../src/shop9/mapear.js";
import { iniciarSimulador } from "../src/shop9/simulador.js";

describe("assinatura do Shop9 (vetores calculados em Python, hmac + base64)", () => {
  it("GET sem corpo, POST com trim e UTF-8", () => {
    assert.equal(
      assinarShop9("senha-do-modulo", "GET", "1763300000"),
      "hVxA0OChg/Wd5t0lReIaJL15jtZclTBUF7KMGNe9AxU=",
    );
    assert.equal(
      assinarShop9(
        "senha-do-modulo",
        "POST",
        "1763300000",
        '  {"codigoCliente":"8599","produtos":[]}\n',
      ),
      "e68oRv0kLfzoLJq/91IZcyIU7mgOatUUpHZCH2UyofY=",
    );
    assert.equal(
      assinarShop9("çáéSenha", "post", "1763300000", '{"observacao":"Orçamento"}'),
      "yerT5ebOPvTFDK4WD+RnRRTzkMZMIYWI1IuXCDpsBG0=",
    );
  });
});

describe("janelas incrementais", () => {
  it("recomeça 2 min antes do cursor e corta na meia-noite", () => {
    const agora = new Date(2026, 10, 17, 0, 30, 0).getTime();
    assert.deepEqual(janelas("2026-11-16 23:50:00", agora, "2025-01-01 00:00:00"), [
      ["2026-11-16 23:48:00", "2026-11-16 23:59:59"],
      ["2026-11-17 00:00:00", "2026-11-17 00:30:00"],
    ]);
  });
  it("sem cursor começa no início configurado", () => {
    const agora = new Date(2026, 0, 2, 8, 0, 0).getTime();
    assert.equal(janelas(null, agora, "2026-01-01 00:00:00").length, 2);
  });
});

describe("venda compartilhada e devolução", () => {
  it("item com vendedor_2 divide meio a meio; centavo ímpar fica com o vendedor_1", () => {
    const s = {
      total_Com_Desconto: 100.01,
      codigo_Vendedor_1: 6,
      codigo_Vendedor_2: 9,
      produtos: [{ preco_Final_Com_Desconto: 100.01, codigo_Vendedor_1: 6, codigo_Vendedor_2: 9 }],
    };
    assert.deepEqual(dividirVenda(s), [
      { vendedor_codigo: "6", valor_centavos: 5001 },
      { vendedor_codigo: "9", valor_centavos: 5000 },
    ]);
  });
  it("cada item vai para o seu vendedor e a soma bate com o total da saída (desconto geral)", () => {
    const s = {
      total_Com_Desconto: 90,
      codigo_Vendedor_1: 6,
      codigo_Vendedor_2: 0,
      produtos: [
        { preco_Final_Com_Desconto: 60, codigo_Vendedor_1: 6, codigo_Vendedor_2: 0 },
        { preco_Final_Com_Desconto: 40, codigo_Vendedor_1: 7, codigo_Vendedor_2: 0 },
      ],
    };
    const p = dividirVenda(s);
    assert.deepEqual(p, [
      { vendedor_codigo: "6", valor_centavos: 5400 },
      { vendedor_codigo: "7", valor_centavos: 3600 },
    ]);
  });
  it("sem itens com valor, divide a saída entre vendedor_1 e vendedor_2", () => {
    const p = dividirVenda({
      total_Com_Desconto: 0.03,
      codigo_Vendedor_1: 1,
      codigo_Vendedor_2: 2,
      produtos: [],
    });
    assert.deepEqual(
      p.map((x) => x.valor_centavos),
      [2, 1],
    );
  });
  it("só conta faturada: efetivada no financeiro e não desfeita; data só da passada por efetivação", () => {
    const base = {
      ordem: 1,
      codigo_Cliente: 5,
      total_Com_Desconto: 10,
      codigo_Vendedor_1: 6,
      produtos: [],
    };
    assert.equal(venda({ ...base, efetivadoFinanceiro: true }, "2026-11-16").faturada, true);
    assert.equal(
      venda({ ...base, efetivadoFinanceiro: true, desefetivadoFinanceiro: true }).faturada,
      false,
    );
    assert.equal(venda({ ...base, efetivadoFinanceiro: false }).faturada, false);
    assert.equal(venda(base).data_faturamento, null);
  });
  it("devolução leva os vendedores e a saída de origem para descontar da meta", () => {
    const d = devolucao(
      {
        ordem: 77,
        codigo_Cliente: 5,
        total_Com_Desconto: 50,
        codigo_Vendedor_1: 6,
        codigo_Vendedor_2: 9,
        ordem_Saida: 21945,
        produtos: [],
      },
      "2026-11-16",
    );
    assert.equal(d.faturada, true);
    assert.equal(d.saida_origem, "21945");
    assert.deepEqual(
      d.partes.map((x) => x.valor_centavos),
      [2500, 2500],
    );
  });
});

describe("cliente e adaptador contra o simulador", () => {
  let sim, cred;
  const empresa = {
    empresa_id: "e1",
    codfilial: "1",
    codigo_operacao_orcamento: "209",
    tipo_operacao_orcamento: "ORC",
    tabela_preco: "VAREJISTA",
    codigo_caixa: 1,
  };
  before(async () => {
    sim = await iniciarSimulador();
    cred = { url: sim.url, serie: sim.serie, senha: sim.senha };
  });
  after(() => sim.fechar());

  it("renova o token antes de expirar e quando o Shop9 o recusa (repete uma vez)", async () => {
    let agora = Date.now();
    const c = criarClienteShop9(cred, { agora: () => agora });
    const t1 = await c.token("1");
    assert.equal(await c.token("1"), t1, "reusa enquanto válido");
    agora += 59 * 60_000; // faltam menos de 2 min para o expireAt (1 h)
    const t2 = await c.token("1");
    assert.notEqual(t2, t1);
    sim.expirarTokens(); // o servidor esqueceu os tokens
    const r = await c.pedir("get", "/clientes/1", "1");
    assert.equal(r.sucesso, true);
  });

  it("token é por filial e a senha errada vira AUTENTICACAO_INVALIDA sem laço", async () => {
    const c = criarClienteShop9({ ...cred, senha: "errada" });
    await assert.rejects(
      c.pedir("get", "/clientes/1", "1"),
      (e) => e.tipo === "AUTENTICACAO_INVALIDA",
    );
    await assert.rejects(criarClienteShop9(cred).token("2"), (e) => e instanceof ErroShop9);
  });

  it("pagina de 20 em 20 até FIM_DE_PAGINA", async () => {
    for (let i = 0; i < 44; i++)
      sim.dados.clientes.push(
        sim.marca({ codigo: 9000 + i, nome: `Cliente ${i}`, vendedor1: { codigo: 6 } }),
      );
    const paginas = [];
    for await (const pg of criarClienteShop9(cred).paginar("clientes", "1"))
      paginas.push(pg.registros.length);
    assert.deepEqual(paginas, [20, 20, 5]);
  });

  it("licença inválida é erro definitivo", async () => {
    sim.ganchos.licencaInvalida = true;
    sim.expirarTokens();
    await assert.rejects(
      criarClienteShop9(cred).token("1"),
      (e) => e.tipo === "LICENCA_EXPIRADA_OU_INVALIDA" && e.definitivo,
    );
    sim.ganchos.licencaInvalida = false;
  });

  it("orçamento: resposta perdida após criar não duplica; a ordem é achada pela marca ROTA:<id>", async () => {
    const shop9 = criarAdaptadorShop9(cred, { timeoutMs: 2000 });
    const t = {
      envio_id: "e0000000-0000-4000-8000-000000000009",
      cliente_codigo: "5175",
      vendedor_codigo_shop9: "6",
      data: "2026-11-16",
      itens: [{ codigo_produto: "20098", quantidade: 2, preco_unit: 3500, desconto_pct: 5 }],
    };
    sim.ganchos.perderRespostaDoProximoPost = true;
    await assert.rejects(shop9.enviarOrcamento(empresa, t), (e) => !e.definitivo);
    const ordem = await shop9.enviarOrcamento(empresa, t);
    const minhas = sim.dados.saidas.filter((s) => s.referenciaInterna === `ROTA:${t.envio_id}`);
    assert.equal(minhas.length, 1, "uma só saída no Shop9");
    assert.equal(ordem, String(minhas[0].ordem));
    assert.equal(minhas[0].efetivadoFinanceiro, false, "não efetiva estoque nem financeiro");
    assert.equal(minhas[0].codigoOperacao, 209);
    assert.equal(minhas[0].produtos[0].preco_Final_Com_Desconto, 6650);
    assert.equal(await shop9.enviarOrcamento(empresa, t), ordem, "reenvio devolve a mesma ordem");
  });

  it("cliente inexistente é recusa de regra (CAMPO_INVALIDO), sem criar nada", async () => {
    const shop9 = criarAdaptadorShop9(cred);
    const antes = sim.dados.saidas.length;
    await assert.rejects(
      shop9.enviarOrcamento(empresa, {
        envio_id: "x1",
        cliente_codigo: "404",
        data: "2026-11-16",
        itens: [{ codigo_produto: "1", quantidade: 1, preco_unit: 1 }],
      }),
      (e) => e.tipo === "CAMPO_INVALIDO" && e.definitivo,
    );
    assert.equal(sim.dados.saidas.length, antes);
  });
});
