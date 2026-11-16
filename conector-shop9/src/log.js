import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Registro local em linhas JSON, sem dados sensíveis: só evento, ids técnicos e mensagem curta.
 * Chaves suspeitas são trocadas por "***" e textos longos cortados (nunca grava corpo de cliente).
 */
const SENSIVEL =
  /token|senha|password|secret|privad|serie|assinatura|authorization|signature|cpf|cnpj|telefone|email/i;
const MAX_ARQUIVO = 5 * 1024 * 1024;

export function limpar(valor, chave = "") {
  if (SENSIVEL.test(chave)) return "***";
  if (typeof valor === "string") return valor.length > 300 ? `${valor.slice(0, 300)}…` : valor;
  if (Array.isArray(valor)) return `[${valor.length} itens]`;
  if (valor && typeof valor === "object")
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, limpar(v, k)]));
  return valor;
}

export function criarLog(arquivo) {
  if (arquivo) mkdirSync(dirname(arquivo), { recursive: true });
  return (nivel, evento, dados = {}) => {
    const linha = JSON.stringify({ em: new Date().toISOString(), nivel, evento, ...limpar(dados) });
    if (!arquivo) return console.log(linha);
    try {
      if (statSync(arquivo, { throwIfNoEntry: false })?.size > MAX_ARQUIVO)
        renameSync(arquivo, `${arquivo}.1`);
      appendFileSync(arquivo, `${linha}\n`);
    } catch {
      console.log(linha);
    }
  };
}
