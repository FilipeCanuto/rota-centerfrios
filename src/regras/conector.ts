/**
 * Assinatura das requisições do conector Shop9 (mesmo algoritmo em conector-shop9/src/assinatura.js).
 * Ed25519: a chave privada nasce e fica só no computador do conector; a Rota guarda só a chave pública,
 * então nem um vazamento do banco permite falsificar pedidos.
 * Sem rede e sem node:crypto (Web Crypto), para rodar no servidor e nos testes.
 */
export const JANELA_ASSINATURA_MS = 5 * 60 * 1000;
/** O conector manda heartbeat a cada minuto; sem contato por 3 minutos = offline. */
export const OFFLINE_APOS_MS = 3 * 60 * 1000;

export const conectorOnline = (ultimoContato: string | null, agora = Date.now()) =>
  !!ultimoContato && agora - Date.parse(ultimoContato) <= OFFLINE_APOS_MS;

const utf8 = (s: string) => new TextEncoder().encode(s);

export async function sha256Hex(texto: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", utf8(texto));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** base64url → bytes; null se tiver caractere inválido. */
function deBase64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Chave pública Ed25519 crua (32 bytes) em base64url: 43 caracteres. */
export const chavePublicaValida = (s: string) => deBase64url(s.trim())?.length === 32;

export async function textoCanonico(
  ts: string,
  nonce: string,
  metodo: string,
  caminho: string,
  corpo: string,
): Promise<string> {
  return [ts, nonce, metodo.toUpperCase(), caminho, await sha256Hex(corpo)].join("\n");
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

/** Conferência barata, sem rede nem banco: formato dos cabeçalhos e janela de horário. */
export function prechecar(
  p: Pick<PedidoAssinado, "ts" | "nonce" | "assinatura">,
  agora = Date.now(),
): FalhaAssinatura | null {
  if (!p.ts || !p.nonce || !p.assinatura || !/^[\w-]{16,100}$/.test(p.nonce)) return "cabecalhos";
  if (!/^[A-Za-z0-9_-]{86}$/.test(p.assinatura)) return "cabecalhos";
  const ts = Number(p.ts);
  if (!Number.isFinite(ts) || Math.abs(agora - ts) > JANELA_ASSINATURA_MS) return "horario";
  return null;
}

/**
 * Confere horário e assinatura contra uma ou mais chaves (na troca, a anterior vale por alguns minutos).
 * Repetição (nonce já visto), revogação e limite de taxa ficam no banco.
 */
export async function verificarAssinatura(
  chaves: string | string[],
  p: PedidoAssinado,
  agora = Date.now(),
): Promise<FalhaAssinatura | null> {
  const pre = prechecar(p, agora);
  if (pre) return pre;
  const assinatura = deBase64url(p.assinatura!);
  if (assinatura?.length !== 64) return "assinatura";
  const can = utf8(await textoCanonico(p.ts!, p.nonce!, p.metodo, p.caminho, p.corpo));
  for (const chavePublica of [chaves].flat()) {
    const chave = deBase64url(chavePublica);
    if (chave?.length !== 32) continue;
    try {
      const k = await crypto.subtle.importKey("raw", chave, { name: "Ed25519" }, false, ["verify"]);
      if (await crypto.subtle.verify("Ed25519", k, assinatura, can)) return null;
    } catch {
      /* chave inválida: tenta a próxima */
    }
  }
  return "assinatura";
}

/** Código de pareamento: 8 letras/dígitos sem os ambíguos (0, O, 1, I), gerado pelo banco. */
export const normalizarCodigoPareamento = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");
export const codigoPareamentoValido = (s: string) =>
  /^[A-HJ-NP-Z2-9]{8}$/.test(normalizarCodigoPareamento(s));

/**
 * Limite de taxa em memória, antes do banco (por instância do servidor; o banco mantém o limite real).
 * Janela deslizante simples por chave (conector ou IP).
 */
export function criarLimitador(maximo: number, janelaMs: number) {
  const marcas = new Map<string, number[]>();
  return (chave: string, agora = Date.now()) => {
    const recentes = (marcas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= maximo) {
      marcas.set(chave, recentes);
      return false;
    }
    recentes.push(agora);
    marcas.set(chave, recentes);
    // shortcut: limpeza só quando cresce muito; trocar por LRU se houver muitas chaves distintas.
    if (marcas.size > 10_000) marcas.clear();
    return true;
  };
}
