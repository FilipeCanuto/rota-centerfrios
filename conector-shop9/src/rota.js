import { cabecalhosAssinados } from "./assinatura.js";

export class ErroRota extends Error {
  constructor(status, corpo) {
    super(`Rota respondeu ${status}${corpo?.erro ? ` (${corpo.erro})` : ""}`);
    this.status = status;
    this.corpo = corpo;
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
/** Espera progressiva: 1 s, 2 s, 4 s… até 60 s. */
export const espera = (tentativa) => Math.min(60_000, 1000 * 2 ** tentativa);
const reenviavel = (status) => status === 429 || status >= 500;

/**
 * Cliente da Rota: só saída HTTPS, cada chamada assinada com nonce novo.
 * Reenvia em falha de rede, 429 e 5xx; as ações do servidor são idempotentes (lote_id, envio_id).
 */
export function criarClienteRota(cfg, { log = () => {}, esperar = dormir, tentativas = 5 } = {}) {
  const base = cfg.rota_url.replace(/\/$/, "");
  return async function chamar(acao, dados = {}) {
    const caminho = `/api/conector/${acao}`;
    const corpo = JSON.stringify(dados);
    for (let t = 0; ; t++) {
      let status = 0;
      let resposta = null;
      try {
        const r = await fetch(base + caminho, {
          method: "POST",
          headers: cabecalhosAssinados({
            conectorId: cfg.conector_id,
            token: cfg.token,
            metodo: "POST",
            caminho,
            corpo,
          }),
          body: corpo,
          signal: AbortSignal.timeout(30_000),
        });
        status = r.status;
        resposta = await r.json().catch(() => null);
        if (r.ok) return resposta;
      } catch (e) {
        log("aviso", "rota_rede", { acao, mensagem: e.message });
      }
      if (status && !reenviavel(status)) throw new ErroRota(status, resposta);
      if (t + 1 >= tentativas) throw new ErroRota(status || 0, resposta);
      log("aviso", "rota_reenvio", { acao, status, tentativa: t + 1 });
      await esperar(espera(t));
    }
  };
}
