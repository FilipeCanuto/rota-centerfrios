import { createHash, createPublicKey, randomBytes, sign } from "node:crypto";

/**
 * Mesmo algoritmo de src/regras/conector.ts na Rota: Ed25519 sobre
 * `ts \n nonce \n MÉTODO \n caminho \n sha256(corpo)`. A chave privada nunca sai deste computador.
 */
export const sha256Hex = (texto) => createHash("sha256").update(texto, "utf8").digest("hex");

export const textoCanonico = (ts, nonce, metodo, caminho, corpo) =>
  [ts, nonce, metodo.toUpperCase(), caminho, sha256Hex(corpo)].join("\n");

export const assinar = (chavePrivada, canonico) =>
  sign(null, Buffer.from(canonico, "utf8"), chavePrivada).toString("base64url");

/** Chave pública crua (32 bytes) em base64url: é o que se cola na Rota. */
export const chavePublicaDe = (chavePrivada) =>
  createPublicKey(chavePrivada).export({ format: "jwk" }).x;

/** Cabeçalhos de uma requisição assinada. Um nonce novo por chamada (inclusive em reenvio). Sem conectorId = pareamento. */
export function cabecalhosAssinados({
  conectorId,
  chavePrivada,
  metodo,
  caminho,
  corpo,
  agora = Date.now(),
}) {
  const ts = String(agora);
  const nonce = randomBytes(18).toString("base64url");
  return {
    "content-type": "application/json",
    ...(conectorId ? { "x-conector-id": conectorId } : {}),
    "x-conector-ts": ts,
    "x-conector-nonce": nonce,
    "x-conector-assinatura": assinar(
      chavePrivada,
      textoCanonico(ts, nonce, metodo, caminho, corpo),
    ),
  };
}
