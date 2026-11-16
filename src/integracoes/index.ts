import {
  copilotoPorRegras,
  instagramManual,
  shop9EnvioManual,
  shop9PorPlanilha,
  vozDoAparelho,
  whatsappManual,
} from "./manual";
import { shop9EnvioApi } from "./shop9Api";
export * from "./tipos";
export { normalizarTelefone } from "./manual";

/** Ponto único de troca: substitua aqui pelas implementações reais quando houver integração. */
export const integracoes = {
  mensagens: whatsappManual,
  shop9: shop9PorPlanilha,
  /** Padrão manual; com o conector ligado use `envioShop9DoModo` (modo vem de `shop9_integracao`). */
  envioShop9: shop9EnvioManual,
  copiloto: copilotoPorRegras,
  instagram: instagramManual,
  voz: vozDoAparelho,
};

export const envioShop9DoModo = (modo: "manual" | "conector") =>
  modo === "conector" ? shop9EnvioApi : shop9EnvioManual;
