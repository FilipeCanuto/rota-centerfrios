import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { cabecalhosAssinados, chavePublicaDe } from "./assinatura.js";
import { CAMINHO_PADRAO, lerConfig } from "./config.js";
import { criarClienteRota } from "./rota.js";

/**
 * Chave Ed25519 do conector. A privada nasce aqui e nunca sai deste computador; a Rota só vê a pública.
 *   npm run parear -- K7QX-M2PA "CIT servidor"   (código de uso único de Configurações > Integrações)
 *   npm run trocar-chave                          (rotação: assina o pedido com a chave atual)
 */
const novaChave = () => generateKeyPairSync("ed25519").privateKey;
const pem = (k) => k.export({ format: "pem", type: "pkcs8" });

/** Pareamento: assina com a chave nova (prova de posse) e gasta o código. Devolve o id do conector. */
export async function parear({ rotaUrl, codigo, nome, chavePrivada, agora }) {
  const caminho = "/api/conector/parear";
  const corpo = JSON.stringify({ codigo, nome, chave_publica: chavePublicaDe(chavePrivada) });
  const r = await fetch(rotaUrl.replace(/\/$/, "") + caminho, {
    method: "POST",
    headers: cabecalhosAssinados({ chavePrivada, metodo: "POST", caminho, corpo, agora }),
    body: corpo,
    signal: AbortSignal.timeout(30_000),
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok || !dados.conector_id)
    throw new Error(
      r.status === 401 ? "Código inválido, vencido ou já usado." : `Rota respondeu ${r.status}`,
    );
  return dados.conector_id;
}

/** Rotação: a Rota aceita a anterior por alguns minutos (pedidos em trânsito) e depois só a nova. */
export async function trocarChave(cfg, chamar = criarClienteRota(cfg)) {
  const nova = novaChave();
  await chamar("trocar_chave", { chave_publica: chavePublicaDe(nova) });
  return nova;
}

async function principal() {
  const config = process.env.CONECTOR_CONFIG || CAMINHO_PADRAO;
  const arquivo = process.env.CONECTOR_CHAVE || join(dirname(config), "chave-privada.pem");
  const [comando, codigo, nome = "Conector Shop9"] = process.argv.slice(2);
  mkdirSync(dirname(arquivo), { recursive: true });
  if (comando === "parear") {
    if (!codigo) throw new Error('Uso: npm run parear -- CODIGO "nome do computador"');
    const c = JSON.parse(readFileSync(config, "utf8"));
    const chave = novaChave();
    const id = await parear({ rotaUrl: c.rota_url, codigo, nome, chavePrivada: chave });
    if (existsSync(arquivo)) renameSync(arquivo, `${arquivo}.anterior`);
    writeFileSync(arquivo, pem(chave), { mode: 0o600 });
    writeFileSync(config, JSON.stringify({ ...c, conector_id: id }, null, 2));
    console.log(`Pareado. Conector ${id}. Chave privada em ${arquivo} (não copie, não envie).`);
  } else if (comando === "trocar-chave") {
    const nova = await trocarChave(lerConfig(config));
    renameSync(arquivo, `${arquivo}.anterior`);
    writeFileSync(arquivo, pem(nova), { mode: 0o600 });
    console.log(
      "Chave trocada. Reinicie o serviço em até 10 minutos; depois apague chave-privada.pem.anterior.",
    );
  } else throw new Error("Comandos: parear CODIGO [nome] | trocar-chave");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  principal().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
