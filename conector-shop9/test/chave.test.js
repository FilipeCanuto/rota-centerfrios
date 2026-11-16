import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { chavePublicaDe } from "../src/assinatura.js";
import { parear, trocarChave } from "../src/chave.js";
import { criarClienteRota, ErroRota } from "../src/rota.js";
import { iniciarRotaFalsa } from "./rota-falsa.js";

const ID = "11111111-2222-4333-8444-555555555555";
const nova = () => generateKeyPairSync("ed25519").privateKey;

describe("Ed25519: pareamento, troca e revogação", () => {
  let rota;
  const antiga = nova();
  before(async () => {
    rota = await iniciarRotaFalsa({ conectorId: ID, chavePublica: chavePublicaDe(antiga) });
  });
  after(() => rota.fechar());
  const cliente = (chavePrivada) =>
    criarClienteRota(
      { rota_url: rota.url, conector_id: ID, chavePrivada },
      { tentativas: 1, esperar: async () => {} },
    );
  const ping = (k) => cliente(k)("heartbeat", { versao: "t", shop9_ok: true });
  const recusa = (p) => assert.rejects(p, (e) => e instanceof ErroRota && e.status === 401);

  it("pareia com código de uso único e recusa reuso ou código errado", async () => {
    rota.db.codigos.set("K7QXM2PA", { usado: false });
    const k = nova();
    const id = await parear({ rotaUrl: rota.url, codigo: "k7qx-m2pa", nome: "CIT", chavePrivada: k });
    assert.equal(id, ID);
    assert.equal(rota.db.conector.chave_publica, chavePublicaDe(k));
    await assert.rejects(
      parear({ rotaUrl: rota.url, codigo: "K7QXM2PA", nome: "CIT", chavePrivada: nova() }),
      /já usado/,
    );
    await assert.rejects(
      parear({ rotaUrl: rota.url, codigo: "ZZZZZZZZ", nome: "CIT", chavePrivada: nova() }),
      /inválido/,
    );
    await ping(k); // válida
    await recusa(ping(antiga)); // chave anterior ao pareamento não vale mais
    rota.db.conector.chave_publica = chavePublicaDe(antiga);
  });

  it("troca de chave: anterior vale só durante a transição, nova vale já", async () => {
    const k2 = await trocarChave({}, cliente(antiga));
    await ping(k2);
    await ping(antiga); // pedidos em trânsito ainda passam
    rota.db.conector.anterior_ate = Date.now() - 1; // fim da transição
    await recusa(ping(antiga));
    await ping(k2);
  });

  it("revogação é imediata, inclusive para a chave da transição", async () => {
    const atual = nova();
    rota.db.conector.chave_publica = chavePublicaDe(atual);
    const k3 = await trocarChave({}, cliente(atual));
    rota.db.conector.ativo = false;
    await recusa(ping(k3));
    await recusa(ping(atual));
    rota.db.conector.ativo = true;
  });
});
