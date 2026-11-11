/**
 * Contratos das integrações futuras (ERP, WhatsApp, Instagram, IA, voz).
 * As telas dependem só destas interfaces; cada uma tem hoje uma implementação "manual".
 */
export interface LinhaImportada {
  [coluna: string]: string | number | null;
}

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
  mensagemDoDia(contexto: {
    apelido: string;
    clientesHoje: number;
    orcamentosParados: number;
    atingimento: number;
  }): string;
}

export interface PostInstagram {
  url: string;
  legenda: string;
  data: string;
}

export interface FonteInstagram {
  nome: string;
  /** Falso no modo manual: o vendedor registra o post à mão e o supervisor valida. */
  conectado: boolean;
  /** Publicações da conta corporativa do vendedor (vazio enquanto não houver conexão). */
  buscarPosts(vendedorId: string): Promise<PostInstagram[]>;
}

export interface Voz {
  nome: string;
  /** Verdadeiro se o aparelho consegue ler o texto em voz alta. */
  disponivel(): boolean;
  /** Lê o texto em voz alta (resumo do copiloto). */
  falar(texto: string): void;
  parar(): void;
}
