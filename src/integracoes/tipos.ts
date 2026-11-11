/**
 * Contratos das integrações futuras (ERP, WhatsApp, Instagram, IA, voz).
 * As telas dependem só destas interfaces; cada uma tem hoje uma implementação "manual".
 */
export type TipoImportacaoShop9 = "clientes" | "vendas" | "orcamentos";

export interface ResultadoImportacao {
  importacao_id: string;
  inseridas: number;
  atualizadas: number;
  ignoradas: number;
  erros: { linha: number; campo: string; mensagem: string }[];
}

export interface FonteShop9 {
  nome: string;
  /** Grava linhas já validadas (planilha hoje; o módulo Integrações do Shop9 depois). */
  importar(
    tipo: TipoImportacaoShop9,
    empresaId: string,
    arquivo: string,
    linhas: Record<string, unknown>[],
  ): Promise<ResultadoImportacao>;
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
