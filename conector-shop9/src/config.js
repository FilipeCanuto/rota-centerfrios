import { createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Configuração local (padrão C:\ProgramData\ConectorShop9\config.json, com permissão só para o serviço).
 * Credenciais do Shop9 ficam só aqui; nada deste arquivo é enviado à Rota nem gravado no log.
 * A chave privada Ed25519 fica em arquivo próprio (`chave_privada`, padrão ao lado do config.json).
 * SHOP9_SENHA no ambiente do serviço tem prioridade sobre o arquivo.
 */
export const CAMINHO_PADRAO = "C:\\ProgramData\\ConectorShop9\\config.json";

const local = (u) => ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);

export function validarConfig(c, env = process.env) {
  const erros = [];
  const cfg = { intervalo_s: 60, lote: 500, log: null, ...c };
  let url;
  try {
    url = new URL(cfg.rota_url);
  } catch {
    erros.push("rota_url inválida");
  }
  // Só HTTPS para a Rota; http apenas para testes na própria máquina.
  if (url && url.protocol !== "https:" && !local(url)) erros.push("rota_url precisa ser https");
  if (!/^[0-9a-f-]{36}$/i.test(cfg.conector_id ?? "")) erros.push("conector_id ausente");
  if (cfg.chavePrivada?.asymmetricKeyType !== "ed25519")
    erros.push("chave privada Ed25519 ausente");
  for (const amb of ["homologacao", "producao"]) {
    const s = cfg.shop9?.[amb];
    if (!s) continue;
    if (env.SHOP9_SENHA) s.senha = env.SHOP9_SENHA;
    if (!s.url || !s.serie || !s.senha) erros.push(`shop9.${amb} incompleto (url, serie, senha)`);
  }
  if (!cfg.shop9?.homologacao && !cfg.shop9?.producao) erros.push("shop9 sem ambiente");
  if (!cfg.filiais || !Object.keys(cfg.filiais).length)
    erros.push("filiais vazias (empresa_id → código)");
  if (erros.length) throw new Error(`Configuração inválida: ${erros.join("; ")}`);
  return cfg;
}

export function lerConfig(caminho = process.env.CONECTOR_CONFIG || CAMINHO_PADRAO) {
  const c = JSON.parse(readFileSync(caminho, "utf8"));
  const pem = c.chave_privada || join(dirname(caminho), "chave-privada.pem");
  let chavePrivada;
  try {
    chavePrivada = createPrivateKey(readFileSync(pem));
  } catch {
    chavePrivada = null; // validarConfig explica o que falta
  }
  return validarConfig({ ...c, chavePrivada });
}
