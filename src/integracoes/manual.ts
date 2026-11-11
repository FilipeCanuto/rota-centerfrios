import type { CanalMensagens, Copiloto, FonteVendas } from "./tipos";

/** Telefone só com dígitos e com DDI 55 quando faltar. Pelo tamanho: 10–11 dígitos é nacional (DDD + número). */
export function normalizarTelefone(t: string): string {
  const d = t.replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? `55${d}` : d;
}

export const whatsappManual: CanalMensagens = {
  nome: "WhatsApp (link manual)",
  abrirConversa(telefone, mensagem) {
    const q = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
    return `https://wa.me/${normalizarTelefone(telefone)}${q}`;
  },
};

export const vendasPorPlanilha: FonteVendas = {
  nome: "Importação de planilha",
  async importarVendas() {
    return { importadas: 0, erros: ["Importação de planilha ainda não disponível nesta etapa."] };
  },
};

/** Copiloto por regras e modelos de frase — sem IA. */
export const copilotoPorRegras: Copiloto = {
  nome: "Copiloto por regras",
  mensagemDoDia({ apelido, clientesHoje, orcamentosParados, atingimento }) {
    if (clientesHoje === 0 && orcamentosParados === 0)
      return `${apelido} aqui: carteira em dia. Que tal prospectar um cliente novo hoje?`;
    const partes: string[] = [];
    if (clientesHoje > 0) partes.push(`${clientesHoje} ${clientesHoje === 1 ? "cliente precisa" : "clientes precisam"} de você hoje`);
    if (orcamentosParados > 0) partes.push(`${orcamentosParados} ${orcamentosParados === 1 ? "orçamento está parado" : "orçamentos estão parados"}`);
    const fecho = atingimento >= 1 ? " Meta batida — bora passar dela!" : atingimento >= 0.7 ? " A meta está perto." : "";
    return `${apelido} aqui: ${partes.join(" e ")}.${fecho}`;
  },
};
