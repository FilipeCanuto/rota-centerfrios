import type { Shop9Gateway } from "./tipos";

/**
 * Esqueleto da integração direta com a API do Shop9 — DESLIGADO.
 * O envio real roda no servidor (função agendada que lê `shop9_envios`), nunca no navegador:
 * credenciais da Idealsoft só em variáveis do servidor (SHOP9_API_URL, SHOP9_API_TOKEN), nunca no repositório.
 * Ligar: implementar o worker conforme docs/shop9-mapeamento.md e trocar `envioShop9` em ./index.ts.
 */
const desligado = (): never => {
  throw new Error("Integração direta com o Shop9 ainda não liberada.");
};

export const shop9EnvioApi: Shop9Gateway = {
  nome: "API do Shop9",
  automatico: true,
  pendentes: async () => desligado(),
  exportar: desligado,
  marcarEnviado: async () => desligado(),
};
