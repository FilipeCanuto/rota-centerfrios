import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { assinar, cabecalhosAssinados, chavePublicaDe, textoCanonico } from "../src/assinatura.js";
import { validarConfig } from "../src/config.js";
import { limpar } from "../src/log.js";
import { ciclo } from "../src/principal.js";
import { dataHora } from "../src/shop9/adaptador.js";
import { criarClienteRota, ErroRota } from "../src/rota.js";
import { iniciarSimulador } from "../src/shop9/simulador.js";
import { iniciarRotaFalsa } from "./rota-falsa.js";

const CONECTOR_ID = "11111111-2222-4333-8444-555555555555";
const EMPRESA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const { privateKey: CHAVE } = generateKeyPairSync("ed25519");
const PUBLICA = chavePublicaDe(CHAVE);
const { privateKey: OUTRA } = generateKeyPairSync("ed25519");
// Chave do vetor fixo: semente 0x07 × 32 (mesma de src/regras/conector.test.ts).
const VETOR = createPrivateKey({
  key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.alloc(32, 7)]),
  format: "der",
  type: "pkcs8",
});

describe("assinatura", () => {
  it("bate com o vetor de src/regras/conector.test.ts da Rota", () => {
    assert.equal(chavePublicaDe(VETOR), "6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw");
    const can = textoCanonico(
      "1700000000000",
      "nonce-0123456789abcdef",
      "POST",
      "/api/conector/heartbeat",
      "{}",
    );
    assert.equal(
      assinar(VETOR, can),
      "dYSqeaWIhAGH3azVRxIragH2nNd5BoH3LwtDtgx-8CAbIQLZF0WFJiA1RUuV1eDTeEwLkcnGsrbOuYN0E1wbAA",
    );
  });
});

describe("segurança local", () => {
  it("log não grava segredos nem listas de dados", () => {
    const l = limpar({
      token: "abc",
      shop9: { senha: "x", url: "u" },
      linhas: [1, 2],
      mensagem: "ok",
    });
    assert.deepEqual(l, {
      token: "***",
      shop9: { senha: "***", url: "u" },
      linhas: "[2 itens]",
      mensagem: "ok",
    });
  });
  it("config exige https para a Rota e credenciais completas", () => {
    const base = {
      conector_id: CONECTOR_ID,
      chavePrivada: CHAVE,
      shop9: { homologacao: { url: "http://localhost:9009", serie: "s", senha: "p" } },
    };
    assert.throws(
      () => validarConfig({ ...base, rota_url: "http://rota.exemplo.com" }, {}),
      /https/,
    );
    assert.throws(
      () =>
        validarConfig({ ...base, rota_url: "https://r", shop9: { homologacao: { url: "x" } } }, {}),
      /incompleto/,
    );
    assert.equal(validarConfig({ ...base, rota_url: "https://r" }, {}).intervalo_s, 60);
  });
  it("produção só na rede local; teste só no servidor da Idealsoft", () => {
    const com = (shop9) => () =>
      validarConfig({ rota_url: "https://r", conector_id: CONECTOR_ID, chavePrivada: CHAVE, shop9 }, {});
    const cred = (url) => ({ url, serie: "s", senha: "p" });
    assert.throws(com({ producao: cred("http://meu-shop9.exemplo.com.br:8080") }), /rede local/);
    assert.doesNotThrow(com({ producao: cred("http://192.168.0.20:60500") }));
    assert.doesNotThrow(com({ producao: cred("http://servidor-loja:60500") }));
    assert.throws(com({ homologacao: cred("http://192.168.0.20:60500") }), /servidor de teste/);
    assert.doesNotThrow(
      com({ homologacao: cred("http://idealsoftexportaweb.eastus.cloudapp.azure.com:60500/") }),
    );
  });
});


describe("ponta a ponta com o simulador", () => {
  let shop9, rota, ctx, cfg;
  const empresa = {
    empresa_id: EMPRESA,
    codfilial: "1",
    codigo_operacao_orcamento: "209",
    tipo_operacao_orcamento: "ORC",
    tipos_venda: "VND",
    tabela_preco: "VAREJISTA",
    codigo_caixa: 1,
  };
  const envio = (id, cliente) => ({
    envio_id: id,
    empresa_id: EMPRESA,
    chave_idempotencia: `rota:carrinho:${id}`,
    cliente_codigo: cliente,
    vendedor_codigo_shop9: "6",
    data: "2026-11-16",
    itens: [{ codigo_produto: "20098", quantidade: 1, preco_unit: 3500, desconto_pct: 5 }],
    estado: "pendente",
  });
  before(async () => {
    shop9 = await iniciarSimulador();
    rota = await iniciarRotaFalsa({ conectorId: CONECTOR_ID, chavePublica: PUBLICA, empresas: [empresa] });
    cfg = validarConfig(
      {
        rota_url: rota.url,
        conector_id: CONECTOR_ID,
        chavePrivada: CHAVE,
        inicio_sincronizacao: dataHora(new Date(Date.now() - 2 * 86_400_000)),
        shop9: { homologacao: { url: shop9.url, serie: shop9.serie, senha: shop9.senha } },
      },
      {},
    );
    ctx = { cfg, log: () => {}, chamar: criarClienteRota(cfg, { esperar: async () => {} }) };
    // venda faturada compartilhada (vendedores 6 e 9) e uma devolução, ambas efetivadas hoje
    shop9.dados.saidas.push(
      shop9.marca(
        {
          ordem: 500, tipo_Operacao: "VND", codigoOperacao: 500, codigo_Cliente: 5175,
          codigo_Vendedor_1: 6, codigo_Vendedor_2: 9, data: "2026-11-16T10:00:00", total_Com_Desconto: 1000,
          efetivadoFinanceiro: true, desefetivadoFinanceiro: false,
          produtos: [{ codigo: "20098", quantidade: 1, preco_Final_Com_Desconto: 1000, codigo_Vendedor_1: 6, codigo_Vendedor_2: 9 }],
        },
        true,
      ),
    );
    shop9.dados.devolucao.push(
      shop9.marca({ ordem: 70, codigo_Cliente: 5175, codigo_Vendedor_1: 6, total_Com_Desconto: 100, ordem_Saida: 500, produtos: [] }, true),
    );
    // dados de 1 h atrás: fora da sobreposição de 2 min, para o teste incremental ver só o que mudar depois
    const umaHora = dataHora(new Date(Date.now() - 3_600_000));
    for (const lista of Object.values(shop9.dados))
      for (const r of lista) for (const k of ["_cri", "_alt", "_efe"]) if (r[k]) r[k] = umaHora;
    rota.db.envios.push(
      envio("e0000000-0000-4000-8000-000000000001", "5175"),
      envio("e0000000-0000-4000-8000-000000000002", "404"),
    );
  });
  after(async () => Promise.all([shop9.fechar(), rota.fechar()]));

  it("envia orçamentos da fila com a ordem do Shop9 e registra a recusa de regra", async () => {
    const r = await ciclo(ctx);
    assert.equal(r.enviados, 2);
    const [ok, ruim] = rota.db.envios;
    const criada = shop9.dados.saidas.find((s) => s.referenciaInterna === `ROTA:${ok.envio_id}`);
    assert.equal(ok.estado, "enviado");
    assert.equal(ok.codigo_shop9, String(criada.ordem));
    assert.equal(ruim.estado, "erro");
    assert.match(ruim.ultimo_erro, /CAMPO_INVALIDO/);
    assert.equal(rota.db.conector.versao, "0.2.0");
  });

  it("sincroniza vendedores, clientes, produtos com a tabela, estoque, venda dividida e devolução", () => {
    const l = rota.db.linhas;
    assert.equal(l.funcionarios.get("6").email, "ana@exemplo.test");
    assert.equal(l.clientes.get("5175").vendedor_codigo, "6");
    assert.equal(l.produtos.get("20098").preco_tabela, "3500.00");
    assert.equal(l.estoque.get("20098").quantidade, 7);
    const v = l.vendas.get("500");
    assert.equal(v.faturada, true);
    assert.match(v.data_faturamento, /^\d{4}-\d{2}-\d{2}$/, "data da passada por efetivação foi mantida");
    assert.deepEqual(v.partes, [
      { vendedor_codigo: "6", valor_centavos: 50000 },
      { vendedor_codigo: "9", valor_centavos: 50000 },
    ]);
    assert.equal(l.devolucoes.get("70").saida_origem, "500");
    assert.ok(rota.db.cursores.get(`vendas:${EMPRESA}`), "cursor gravado na Rota");
  });

  it("é incremental: sem mudança nada sobe; uma alteração sobe só ela", async () => {
    rota.db.envios[1].reservado_ate = Date.now() + 60_000;
    ctx.ultimaSync = 0; // força a sincronização sem esperar o intervalo
    assert.equal((await ciclo(ctx)).sincronizados, 0);
    const c = shop9.dados.clientes.find((x) => x.codigo === 5175);
    shop9.marca(Object.assign(c, { nome: "Padaria Exemplo Nova" }));
    ctx.ultimaSync = 0;
    const r = await ciclo(ctx);
    assert.equal(r.sincronizados, 1);
    assert.equal(rota.db.linhas.clientes.get("5175").nome, "Padaria Exemplo Nova");
  });

  it("lote repetido é idempotente", async () => {
    const lote = { tipo: "produtos", empresa_id: EMPRESA, lote_id: "produtos:teste:0:1", linhas: [{ codigo_shop9: "P9" }], cursor: null };
    assert.deepEqual(await ctx.chamar("sincronizar", lote), await ctx.chamar("sincronizar", lote));
  });

  it("Shop9 com licença inválida: heartbeat avisa e nada é enviado", async () => {
    shop9.ganchos.licencaInvalida = true;
    shop9.expirarTokens();
    ctx.shop9 = null;
    assert.deepEqual(await ciclo(ctx), { enviados: 0, sincronizados: 0 });
    assert.equal(ctx.shop9Ok, false);
    shop9.ganchos.licencaInvalida = false;
  });

  it("recusa assinatura inválida, repetição e horário fora da janela", async () => {
    const corpo = JSON.stringify({ versao: "x", shop9_ok: true });
    const caminho = "/api/conector/heartbeat";
    const assinar = (chavePrivada, extra = {}) =>
      cabecalhosAssinados({ conectorId: CONECTOR_ID, chavePrivada, metodo: "POST", caminho, corpo, ...extra });
    const enviar = (headers, body = corpo) => fetch(rota.url + caminho, { method: "POST", headers, body });
    const h = assinar(CHAVE);
    assert.equal((await enviar(h)).status, 200);
    assert.equal((await enviar(h)).status, 409, "repetição bloqueada");
    assert.equal((await enviar(assinar(OUTRA))).status, 401, "assinada com outra chave");
    assert.equal((await enviar(assinar(CHAVE), corpo.replace("x", "y"))).status, 401, "corpo alterado");
    assert.equal((await enviar(assinar(CHAVE, { agora: Date.now() - 10 * 60_000 }))).status, 401, "fora da janela");
  });

  it("reenvia com espera progressiva em 5xx", async () => {
    const esperas = [];
    const chamar = criarClienteRota(cfg, { esperar: async (ms) => void esperas.push(ms) });
    rota.db.falharProximas = 2;
    await chamar("heartbeat", { versao: "0.2.0", shop9_ok: true });
    assert.deepEqual(esperas, [1000, 2000]);
  });
});
