import type { OrcamentoParaEnvio } from "@/regras/carrinho";

/**
 * Contratos das integrações futuras (ERP, WhatsApp, Instagram, IA, voz).
 * As telas dependem só destas interfaces; cada uma tem hoje uma implementação "manual".
 */
export type TipoImportacaoShop9 = "produtos" | "clientes" | "vendas" | "orcamentos";

export interface ResultadoImportacao {
  importacao_id: string;
  inseridas: number;
  atualizadas: number;
  ignoradas: number;
  erros: { linha: number; campo: string; mensagem: string }[];
  /** Preenchido se um lote falhou: os lotes anteriores já foram gravados. */
  falha?: string;
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

/**
 * Envio de orçamentos da Rota ao Shop9 (fila `shop9_envios` no banco, com chave de idempotência).
 * "manual": exporta os pendentes em CSV e a pessoa lança no Shop9; "api": envia direto (desligado até a Idealsoft liberar).
 */
export interface Shop9Gateway {
  nome: string;
  automatico: boolean;
  /** Orçamentos da Rota com envio pendente ou com erro, da empresa. */
  pendentes(empresaId: string): Promise<OrcamentoParaEnvio[]>;
  /** Arquivo para lançamento manual (CSV). */
  exportar(orcamentos: OrcamentoParaEnvio[]): string;
  /** Registra que foi lançado no Shop9 com este código; a próxima importação de orçamentos confirma. */
  marcarEnviado(orcamentoId: string, codigoShop9: string): Promise<void>;
}

/** Mensagem recebida de um canal (WhatsApp, e-mail, Instagram). Nunca vai para log nem endereço. */
export interface MensagemRecebida {
  id: string;
  /** Telefone com DDI, e-mail ou usuário do Instagram de quem mandou. */
  de: string;
  texto: string;
  /** Instante em ISO (UTC). */
  em: string;
}

/**
 * Canal de conversa com o cliente que envia e recebe (WhatsApp pela Evolution API, e-mail por SMTP/IMAP).
 * Os segredos ficam só nos Secrets do servidor; a tela nunca recebe nem mostra valores.
 */
export interface CanalConversa {
  nome: string;
  /** "simulado" guarda em memória e não sai da Rota; "real" chama o serviço pelo servidor. */
  modo: "simulado" | "real";
  enviar(para: string, texto: string, assunto?: string): Promise<{ id: string }>;
  /** Mensagens recebidas depois do instante informado (ISO). */
  recebidas(desde: string): Promise<MensagemRecebida[]>;
}
