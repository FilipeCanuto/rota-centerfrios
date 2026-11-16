import {
  copilotoPorRegras,
  instagramManual,
  shop9EnvioManual,
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
  /** Troque por `shop9EnvioApi` (./shop9Api) quando a Idealsoft liberar a API. */
  envioShop9: shop9EnvioManual,
  copiloto: copilotoPorRegras,
  instagram: instagramManual,
  voz: vozDoAparelho,
};
