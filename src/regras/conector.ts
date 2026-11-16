/**
 * Assinatura das requisições do conector Shop9 (mesmo algoritmo em conector-shop9/src/assinatura.js).
 * O banco guarda só sha256(token); essa mesma hash é a chave do HMAC, então o token nunca trafega.
 * Sem rede e sem node:crypto (Web Crypto), para rodar no servidor e nos testes.
 */
export const JANELA_ASSINATURA_MS = 5 * 60 * 1000;
/** O conector manda heartbeat a cada minuto; sem contato por 3 minutos = offline. */
export const OFFLINE_APOS_MS = 3 * 60 * 1000;

export const conectorOnline = (ultimoContato: string | null, agora = Date.now()) =>
  !!ultimoContato && agora - Date.parse(ultimoContato) <= OFFLINE_APOS_MS;

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const utf8 = (s: string) => new TextEncoder().encode(s);

export async function sha256Hex(texto: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", utf8(texto)));
}

export async function textoCanonico(
  ts: string,
  nonce: string,
  metodo: string,
  caminho: string,
  corpo: string,
): Promise<string> {
  return [ts, nonce, metodo.toUpperCase(), caminho, await sha256Hex(corpo)].join("\n");
}

export async function assinar(chaveHex: string, canonico: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    utf8(chaveHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", chave, utf8(canonico)));
}

/** Comparação em tempo constante (mesmo tamanho), para não vazar a assinatura por tempo. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export type FalhaAssinatura = "cabecalhos" | "horario" | "assinatura";

export interface PedidoAssinado {
  ts: string | null;
  nonce: string | null;
  assinatura: string | null;
  metodo: string;
  caminho: string;
  corpo: string;
}

/** Confere horário e HMAC. Repetição (nonce já visto), token revogado e limite de taxa ficam no banco. */
export async function verificarAssinatura(
  tokenHash: string,
  p: PedidoAssinado,
  agora = Date.now(),
): Promise<FalhaAssinatura | null> {
  if (!p.ts || !p.nonce || !p.assinatura || !/^[\w-]{16,100}$/.test(p.nonce)) return "cabecalhos";
  const ts = Number(p.ts);
  if (!Number.isFinite(ts) || Math.abs(agora - ts) > JANELA_ASSINATURA_MS) return "horario";
  const esperada = await assinar(
    tokenHash,
    await textoCanonico(p.ts, p.nonce, p.metodo, p.caminho, p.corpo),
  );
  return iguais(esperada, p.assinatura.toLowerCase()) ? null : "assinatura";
}
