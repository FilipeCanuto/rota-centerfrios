import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Mesmo algoritmo de src/regras/conector.ts na Rota.
 * Chave do HMAC = sha256(token) em hex: o token nunca sai deste computador.
 */
export const sha256Hex = (texto) => createHash("sha256").update(texto, "utf8").digest("hex");

export const textoCanonico = (ts, nonce, metodo, caminho, corpo) =>
  [ts, nonce, metodo.toUpperCase(), caminho, sha256Hex(corpo)].join("\n");

export const assinar = (chaveHex, canonico) =>
  createHmac("sha256", chaveHex).update(canonico, "utf8").digest("hex");

/** Cabeçalhos de uma requisição assinada. Um nonce novo por chamada (inclusive em reenvio). */
export function cabecalhosAssinados({
  conectorId,
  token,
  metodo,
  caminho,
  corpo,
  agora = Date.now(),
}) {
  const ts = String(agora);
  const nonce = randomBytes(18).toString("base64url");
  return {
    "content-type": "application/json",
    "x-conector-id": conectorId,
    "x-conector-ts": ts,
    "x-conector-nonce": nonce,
    "x-conector-assinatura": assinar(
      sha256Hex(token),
      textoCanonico(ts, nonce, metodo, caminho, corpo),
    ),
  };
}
