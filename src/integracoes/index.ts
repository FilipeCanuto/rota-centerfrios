import {
  copilotoPorRegras,
  instagramManual,
  shop9EnvioManual,
  shop9PorPlanilha,
  vozDoAparelho,
  whatsappManual,
} from "./manual";
import { canalSimulado } from "./conexoes";
import { shop9EnvioApi } from "./shop9Api";
export * from "./tipos";
export { CONEXOES, type Conexao } from "./conexoes";
export { normalizarTelefone } from "./manual";

/** Ponto único de troca: substitua aqui pelas implementações reais quando houver integração. */
export const integracoes = {
  mensagens: whatsappManual,
  shop9: shop9PorPlanilha,
  /** Padrão manual; com o conector ligado use `envioShop9DoModo` (modo vem de `shop9_integracao`). */
  envioShop9: shop9EnvioManual,
  copiloto: copilotoPorRegras,
  instagram: instagramManual,
  /** Simulados até as conexões reais (docs/auditoria-fable.md, seção 5.2). */
  whatsapp: canalSimulado("WhatsApp (simulado)"),
  email: canalSimulado("E-mail (simulado)"),
  voz: vozDoAparelho,
};

export const envioShop9DoModo = (modo: "manual" | "conector") =>
  modo === "conector" ? shop9EnvioApi : shop9EnvioManual;
