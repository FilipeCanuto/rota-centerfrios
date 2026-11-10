/**
 * Contratos das integrações futuras (ERP, WhatsApp, Instagram, IA, voz).
 * As telas dependem só destas interfaces; cada uma tem hoje uma implementação "manual".
 */
export interface LinhaImportada { [coluna: string]: string | number | null }

export interface FonteVendas {
  nome: string;
  /** Importa vendas faturadas (planilha hoje, ERP depois). */
  importarVendas(linhas: LinhaImportada[]): Promise<{ importadas: number; erros: string[] }>;
}

export interface CanalMensagens {
  nome: string;
  /** Abre ou envia uma conversa com o cliente. */
  abrirConversa(telefone: string, mensagem?: string): string;
}

export interface Copiloto {
  nome: string;
  mensagemDoDia(contexto: { apelido: string; clientesHoje: number; orcamentosParados: number; atingimento: number }): string;
}
