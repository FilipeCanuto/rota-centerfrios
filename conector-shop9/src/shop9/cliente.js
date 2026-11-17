import { createHmac } from "node:crypto";

/**
 * Cliente do módulo Integrações do Shop9 (docs/shop9-api-referencia.md). Não conhece a Rota.
 * Segredos (série, senha) só vivem aqui e nunca vão para log nem para a Rota.
 */

/** Signature = base64(HMAC-SHA256(senha, metodo_minusculo + timestamp + base64(trim(corpo)))). */
export function assinarShop9(senha, metodo, timestamp, corpo = "") {
  const b64 = corpo.trim() ? Buffer.from(corpo.trim(), "utf8").toString("base64") : "";
  return createHmac("sha256", senha)
    .update(`${metodo.toLowerCase()}${timestamp}${b64}`, "utf8")
    .digest("base64");
}

// shortcut: a documentação não diz o formato do Timestamp; usamos segundos Unix. Trocar aqui quando a Idealsoft responder.
export const timestampShop9 = (agora = Date.now()) => String(Math.floor(agora / 1000));

/** Erros que não adianta repetir igual (regra, campo, licença). Rede e servidor são temporários. */
const DEFINITIVOS = new Set([
  "CAMPO_INVALIDO",
  "BODY_INVALIDO",
  "HEADER_INVALIDO",
  "REGISTRO_NAO_ENCONTRADO",
  "TIPO_BUSCA_INVALIDO",
  "LICENCA_EXPIRADA_OU_INVALIDA",
]);

export class ErroShop9 extends Error {
  constructor(tipo, mensagem, statusCode = 0) {
    super(mensagem);
    this.tipo = tipo;
    this.statusCode = statusCode;
    this.definitivo = DEFINITIVOS.has(tipo);
  }
}

const RENOVAR_ANTES_MS = 2 * 60_000;
const MAX_PAGINAS = 5000;

/** s = { url, serie, senha }. `fetch` e `agora` injetáveis para teste. */
export function criarClienteShop9(s, { fetch: f = fetch, agora = Date.now, timeoutMs = 30_000 } = {}) {
  const base = s.url.replace(/\/$/, "");
  const tokens = new Map(); // codfilial → { token, expira }

  async function http(metodo, caminho, cabecalhos, corpo) {
    let r;
    try {
      r = await f(base + caminho, {
        method: metodo.toUpperCase(),
        headers: { "content-type": "application/json", ...cabecalhos },
        body: corpo || undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new ErroShop9(e.name === "TimeoutError" ? "TEMPO_ESGOTADO" : "REDE", `Shop9 indisponível: ${e.message}`);
    }
    const env = await r.json().catch(() => null);
    if (!env || typeof env.sucesso !== "boolean")
      throw new ErroShop9("RESPOSTA_INVALIDA", `Shop9 respondeu HTTP ${r.status} fora do envelope`);
    return env;
  }

  async function token(codfilial) {
    const t = tokens.get(codfilial);
    if (t && t.expira - RENOVAR_ANTES_MS > agora()) return t.token;
    const q = new URLSearchParams({ serie: s.serie, codfilial: String(codfilial) });
    const env = await http("get", `/auth/?${q}`, {});
    if (!env.sucesso || !env.dados?.token)
      throw new ErroShop9(env.tipo || "AUTENTICACAO_INVALIDA", env.mensagem || "Falha ao gerar token", env.statusCode);
    const expira = Date.parse(env.dados.expireAt) || agora() + 10 * 60_000;
    tokens.set(codfilial, { token: env.dados.token, expira });
    return env.dados.token;
  }

  /** Uma chamada assinada. Devolve o envelope (inclusive FIM_DE_PAGINA); lança nos demais erros. */
  async function pedir(metodo, caminho, codfilial, dados) {
    const corpo = dados === undefined ? "" : JSON.stringify(dados);
    for (let tentativa = 0; ; tentativa++) {
      const ts = timestampShop9(agora());
      const env = await http(metodo, caminho, {
        Authorization: `Token ${await token(codfilial)}`,
        CodFilial: String(codfilial),
        Timestamp: ts,
        Signature: assinarShop9(s.senha, metodo, ts, corpo),
      }, corpo);
      if (env.sucesso || env.tipo === "FIM_DE_PAGINA") return env;
      if (env.tipo === "AUTENTICACAO_INVALIDA" && tentativa === 0) {
        tokens.delete(codfilial); // token vencido antes da hora: renova e repete uma vez
        continue;
      }
      throw new ErroShop9(env.tipo || "EXCECAO_SERVIDOR", env.mensagem || "Erro do Shop9", env.statusCode);
    }
  }

  /** Percorre /recurso/1, /2… até FIM_DE_PAGINA ou página vazia. Entrega uma página por vez. */
  async function* paginar(recurso, codfilial, filtros = {}) {
    const q = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v != null && v !== ""));
    for (let p = 1; p <= MAX_PAGINAS; p++) {
      const env = await pedir("get", `/${recurso}/${p}${q.size ? `?${q}` : ""}`, codfilial);
      if (env.tipo === "FIM_DE_PAGINA") return;
      const lista = Array.isArray(env.dados) ? env.dados : env.dados ? [env.dados] : [];
      if (!lista.length) return;
      yield { pagina: p, registros: lista };
    }
    throw new ErroShop9("PAGINACAO", `Mais de ${MAX_PAGINAS} páginas em ${recurso}`);
  }

  return { token, pedir, paginar };
}
