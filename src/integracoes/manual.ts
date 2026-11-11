import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  CanalMensagens,
  Copiloto,
  FonteInstagram,
  FonteShop9,
  ResultadoImportacao,
  Voz,
} from "./tipos";

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

const LOTE = 5000; // limite por chamada das funções importar_* no banco

/** Planilha exportada do Shop9: grava pelas funções do banco (só diretoria), em lotes. */
export const shop9PorPlanilha: FonteShop9 = {
  nome: "Planilha do Shop9",
  async importar(tipo, empresaId, arquivo, linhas) {
    const total: ResultadoImportacao = {
      importacao_id: "",
      inseridas: 0,
      atualizadas: 0,
      ignoradas: 0,
      erros: [],
    };
    for (let i = 0; i < linhas.length; i += LOTE) {
      const { data, error } = await supabase.rpc(`importar_${tipo}`, {
        _empresa_id: empresaId,
        _arquivo: arquivo,
        _linhas: linhas.slice(i, i + LOTE) as Json,
      });
      if (error) {
        total.falha =
          i === 0
            ? error.message
            : `${error.message} (as primeiras ${i} linhas já foram gravadas; reimportar o arquivo não duplica).`;
        return total;
      }
      const r = data as unknown as ResultadoImportacao;
      total.importacao_id ||= r.importacao_id;
      total.inseridas += r.inseridas;
      total.atualizadas += r.atualizadas;
      total.ignoradas += r.ignoradas;
      total.erros.push(...r.erros);
    }
    return total;
  },
};

/** Copiloto por regras e modelos de frase — sem IA. */
export const copilotoPorRegras: Copiloto = {
  nome: "Copiloto por regras",
  mensagemDoDia({ apelido, clientesHoje, orcamentosParados, atingimento }) {
    if (clientesHoje === 0 && orcamentosParados === 0)
      return `${apelido} aqui: carteira em dia. Que tal prospectar um cliente novo hoje?`;
    const partes: string[] = [];
    if (clientesHoje > 0)
      partes.push(
        `${clientesHoje} ${clientesHoje === 1 ? "cliente precisa" : "clientes precisam"} de você hoje`,
      );
    if (orcamentosParados > 0)
      partes.push(
        `${orcamentosParados} ${orcamentosParados === 1 ? "orçamento está parado" : "orçamentos estão parados"}`,
      );
    const fecho =
      atingimento >= 1
        ? " Meta batida — bora passar dela!"
        : atingimento >= 0.7
          ? " A meta está perto."
          : "";
    return `${apelido} aqui: ${partes.join(" e ")}.${fecho}`;
  },
};

/**
 * Instagram sem API: não há leitura automática de posts (lista vazia). No modo manual, o vendedor
 * registra o post na tela de gamificação e o supervisor valida; isso vive no banco, não aqui.
 */
export const instagramManual: FonteInstagram = {
  nome: "Instagram (registro manual)",
  conectado: false,
  async buscarPosts() {
    return [];
  },
};

/** Voz do próprio aparelho (Web Speech API), até a voz do copiloto chegar na Fase 3. */
export const vozDoAparelho: Voz = {
  nome: "Voz do aparelho",
  disponivel: () => typeof window !== "undefined" && "speechSynthesis" in window,
  falar(texto) {
    if (!vozDoAparelho.disponivel()) return;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    window.speechSynthesis.speak(fala);
  },
  parar() {
    if (vozDoAparelho.disponivel()) window.speechSynthesis.cancel();
  },
};
