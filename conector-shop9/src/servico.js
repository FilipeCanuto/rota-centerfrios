import { dirname, join } from "node:path";
import { CAMINHO_PADRAO, lerConfig } from "./config.js";
import { criarLog } from "./log.js";
import { ciclo, criarEstado, VERSAO } from "./principal.js";
import { criarClienteRota, ErroRota } from "./rota.js";

/** Ponto de entrada do serviço do Windows (ver docs/guia-conector-shop9-cit.md). */
const caminho = process.env.CONECTOR_CONFIG || CAMINHO_PADRAO;
const pasta = dirname(caminho);
const cfg = lerConfig(caminho);
const log = criarLog(cfg.log ?? join(pasta, "logs", "conector.log"));
const ctx = {
  cfg,
  log,
  chamar: criarClienteRota(cfg, { log }),
  estado: criarEstado(join(pasta, "estado.json")),
};

let parar = false;
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => (parar = true));
log("info", "inicio", { versao: VERSAO });

while (!parar) {
  try {
    const r = await ciclo(ctx);
    if (r.enviados || r.sincronizados) log("info", "ciclo", r);
  } catch (e) {
    log("erro", "ciclo_falhou", {
      mensagem: e.message,
      status: e instanceof ErroRota ? e.status : undefined,
    });
    // Token revogado ou trocado: espera mais para não martelar a Rota.
    if (e instanceof ErroRota && e.status === 401)
      await new Promise((r) => setTimeout(r, 10 * 60_000));
  }
  await new Promise((r) => setTimeout(r, cfg.intervalo_s * 1000));
}
log("info", "fim");
