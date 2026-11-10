import { copilotoPorRegras, vendasPorPlanilha, whatsappManual } from "./manual";
export * from "./tipos";
export { normalizarTelefone } from "./manual";

/** Ponto único de troca: substitua aqui pelas implementações reais quando houver integração. */
export const integracoes = {
  mensagens: whatsappManual,
  vendas: vendasPorPlanilha,
  copiloto: copilotoPorRegras,
};
