import {
  copilotoPorRegras,
  instagramManual,
  shop9PorPlanilha,
  vozDoAparelho,
  whatsappManual,
} from "./manual";
export * from "./tipos";
export { normalizarTelefone } from "./manual";

/** Ponto único de troca: substitua aqui pelas implementações reais quando houver integração. */
export const integracoes = {
  mensagens: whatsappManual,
  shop9: shop9PorPlanilha,
  copiloto: copilotoPorRegras,
  instagram: instagramManual,
  voz: vozDoAparelho,
};
