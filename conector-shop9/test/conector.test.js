import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { assinar, cabecalhosAssinados, sha256Hex, textoCanonico } from "../src/assinatura.js";
import { validarConfig } from "../src/config.js";
import { limpar } from "../src/log.js";
import { ciclo, criarEstado } from "../src/principal.js";
import { criarClienteRota, ErroRota } from "../src/rota.js";
import { iniciarSimulador } from "../src/shop9/simulador.js";
import { iniciarRotaFalsa } from "./rota-falsa.js";

const CONECTOR_ID = "11111111-2222-4333-8444-555555555555";
const EMPRESA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TOKEN = "t".repeat(48);

describe("assinatura", () => {
  it("bate com o vetor de src/regras/conector.test.ts da Rota", () => {
    const chave = sha256Hex("token-de-teste");
    assert.equal(chave, "20fd0ba9f641280a22f72a1145a0892b225fb0b2fdd75a53ba4f83f4596c72ae");
    const can = textoCanonico(
      "1700000000000",
      "nonce-0123456789abcdef",
      "POST",
      "/api/conector/heartbeat",
      "{}",
    );
    assert.equal(
      assinar(chave, can),
      "7e5c9d6a074633f9f3adcb73252742b69b07129fd9737c0298515c22ee37f55d",
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
      token: TOKEN,
      filiais: { [EMPRESA]: "01" },
      shop9: { homologacao: { url: "http://s", serie: "s", senha: "p" } },
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
});

describe("ponta a ponta com o simulador", () => {
  let shop9, rota, ctx, cfg;
  before(async () => {
    shop9 = await iniciarSimulador();
    rota = await iniciarRotaFalsa({ conectorId: CONECTOR_ID, token: TOKEN });
    cfg = validarConfig(
      {
        rota_url: rota.url,
        conector_id: CONECTOR_ID,
        token: TOKEN,
        filiais: { [EMPRESA]: "01" },
        shop9: { homologacao: { url: shop9.url, serie: shop9.serie, senha: shop9.senha } },
      },
      {},
    );
    ctx = {
      cfg,
      log: () => {},
      estado: criarEstado(null),
      chamar: criarClienteRota(cfg, { esperar: async () => {} }),
    };
    const envio = (id, cliente) => ({
      envio_id: id,
      empresa_id: EMPRESA,
      chave_idempotencia: `rota:carrinho:${id}`,
      cliente_codigo: cliente,
      data: "2026-11-16",
      vendedor_email: "vendedor@exemplo.test",
      itens: [
        {
          codigo_produto: "P1",
          descricao: "Freezer",
          unidade: "UN",
          quantidade: 1,
          preco_unit: 3500,
          desconto_pct: 5,
          total: 3325,
        },
      ],
      estado: "pendente",
    });
    rota.db.envios.push(
      envio("e0000000-0000-4000-8000-000000000001", "C1"),
      envio("e0000000-0000-4000-8000-000000000002", "NAO-EXISTE"),
    );
  });
  after(async () => Promise.all([shop9.fechar(), rota.fechar()]));

  it("envia orçamentos da fila, devolve o código e registra o erro de regra", async () => {
    const r = await ciclo(ctx);
    assert.equal(r.enviados, 2);
    const [ok, ruim] = rota.db.envios;
    assert.equal(ok.estado, "enviado");
    assert.equal(ok.codigo_shop9, "ORC-1");
    assert.equal(ruim.estado, "erro");
    assert.match(ruim.ultimo_erro, /Cliente não cadastrado/);
    assert.equal(rota.db.conector.versao, "0.1.0");
  });

  it("sincroniza clientes, produtos, vendas e o orçamento criado", () => {
    for (const tipo of ["clientes", "produtos", "vendas", "orcamentos"])
      assert.equal(rota.db.linhas[tipo].size, 1, tipo);
    assert.equal(rota.db.linhas.orcamentos.get("ORC-1").valor, 3325);
    assert.equal(rota.db.linhas.clientes.get("C1").nome, "Padaria Exemplo");
  });

  it("é incremental: só o que mudou volta a subir", async () => {
    const lotes = rota.db.lotes.size;
    rota.db.envios[1].reservado_ate = Date.now() + 60_000; // o erro fica na espera progressiva da Rota
    assert.equal((await ciclo(ctx)).sincronizados, 0);
    shop9.dados.produtos.push(
      shop9.marca({ Codigo: "P2", Descricao: "Balcão", Unidade: "UN", Preco: 900, Ativo: true }),
    );
    assert.equal((await ciclo(ctx)).sincronizados, 1);
    assert.equal(rota.db.lotes.size, lotes + 1);
  });

  it("idempotente: mesmo lote e mesmo orçamento não duplicam", async () => {
    const lote = {
      tipo: "produtos",
      empresa_id: EMPRESA,
      lote_id: "produtos:teste:0:1",
      linhas: [{ codigo_shop9: "P9" }],
    };
    const a = await ctx.chamar("sincronizar", lote);
    const b = await ctx.chamar("sincronizar", lote);
    assert.deepEqual(a, b);
    assert.equal(b.inseridas, 1);
    // Reenvio do mesmo orçamento ao Shop9 (resposta perdida) devolve o mesmo número.
    const [e] = rota.db.envios;
    e.estado = "pendente";
    await ciclo(ctx);
    assert.equal(e.codigo_shop9, "ORC-1");
    assert.equal(shop9.dados.orcamentos.length, 1);
  });

  it("recusa assinatura inválida e repetição do mesmo pedido", async () => {
    const corpo = JSON.stringify({ versao: "x", shop9_ok: true });
    const caminho = "/api/conector/heartbeat";
    const h = cabecalhosAssinados({
      conectorId: CONECTOR_ID,
      token: TOKEN,
      metodo: "POST",
      caminho,
      corpo,
    });
    const enviar = (headers, body = corpo) =>
      fetch(rota.url + caminho, { method: "POST", headers, body });
    assert.equal((await enviar(h)).status, 200);
    assert.equal((await enviar(h)).status, 409, "repetição bloqueada");
    const outro = cabecalhosAssinados({
      conectorId: CONECTOR_ID,
      token: "x".repeat(48),
      metodo: "POST",
      caminho,
      corpo,
    });
    assert.equal((await enviar(outro)).status, 401, "token errado");
    const h2 = cabecalhosAssinados({
      conectorId: CONECTOR_ID,
      token: TOKEN,
      metodo: "POST",
      caminho,
      corpo,
    });
    assert.equal((await enviar(h2, corpo.replace("x", "y"))).status, 401, "corpo alterado");
    const velho = cabecalhosAssinados({
      conectorId: CONECTOR_ID,
      token: TOKEN,
      metodo: "POST",
      caminho,
      corpo,
      agora: Date.now() - 10 * 60_000,
    });
    assert.equal((await enviar(velho)).status, 401, "fora da janela");
  });

  it("reenvia com espera progressiva em 5xx", async () => {
    const esperas = [];
    const chamar = criarClienteRota(cfg, { esperar: async (ms) => void esperas.push(ms) });
    rota.db.falharProximas = 2;
    await chamar("heartbeat", { versao: "0.1.0", shop9_ok: true });
    assert.deepEqual(esperas, [1000, 2000]);
  });

  it("token revogado para sem reenviar", async () => {
    rota.db.conector.ativo = false;
    await assert.rejects(
      ctx.chamar("heartbeat", { versao: "0.1.0", shop9_ok: true }),
      (e) => e instanceof ErroRota && e.status === 401,
    );
    rota.db.conector.ativo = true;
  });
});
