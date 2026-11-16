import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chavePublicaDe } from "./assinatura.js";
import { CAMINHO_PADRAO } from "./config.js";

/**
 * `npm run gerar-chave` (primeira instalação) ou `npm run gerar-chave -- --trocar` (rotação).
 * Grava a chave privada ao lado do config.json e mostra a pública para cadastrar na Rota.
 * Na troca, a anterior vira chave-privada.pem.anterior até a nova ser cadastrada na Rota.
 */
const destino =
  process.env.CONECTOR_CHAVE ||
  join(dirname(process.env.CONECTOR_CONFIG || CAMINHO_PADRAO), "chave-privada.pem");
const trocar = process.argv.includes("--trocar");

if (existsSync(destino) && !trocar) {
  console.error(`Já existe ${destino}. Para trocar a chave use: npm run gerar-chave -- --trocar`);
  process.exit(1);
}
mkdirSync(dirname(destino), { recursive: true });
if (existsSync(destino)) renameSync(destino, `${destino}.anterior`);
const { privateKey } = generateKeyPairSync("ed25519");
writeFileSync(destino, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
console.log(`Chave privada gravada em ${destino} (não copie, não envie).`);
console.log("Cadastre esta chave pública em Configurações > Integrações > Shop9:");
console.log(chavePublicaDe(privateKey));
