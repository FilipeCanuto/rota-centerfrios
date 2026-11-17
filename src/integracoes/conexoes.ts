import type { CanalConversa, MensagemRecebida } from "./tipos";

/**
 * Canal em modo simulado: guarda as mensagens em memória, não sai da Rota.
 * Serve para as telas e os testes enquanto as conexões reais não chegam.
 */
export function canalSimulado(
  nome: string,
): CanalConversa & { simularRecebida(m: MensagemRecebida): void } {
  const recebidas: MensagemRecebida[] = [];
  let seq = 0;
  return {
    nome,
    modo: "simulado",
    async enviar(para) {
      if (!para.trim()) throw new Error("Destinatário vazio.");
      return { id: `simulado-${++seq}` };
    },
    async recebidas(desde) {
      return recebidas.filter((m) => m.em > desde);
    },
    simularRecebida(m) {
      recebidas.push(m);
    },
  };
}

/** O que a aba Configurações → Integrações mostra de cada conexão futura (só nomes de Secrets, nunca valores). */
export interface Conexao {
  chave: "whatsapp" | "email" | "instagram";
  nome: string;
  descricao: string;
  /** Nomes dos Secrets que o servidor vai ler (Lovable → Secrets). */
  segredos: string[];
  falta: string[];
}

export const CONEXOES: Conexao[] = [
  {
    chave: "whatsapp",
    nome: "WhatsApp (Evolution API)",
    descricao: "Enviar e receber mensagens dos clientes e registrar o contato na ficha.",
    segredos: ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCIA"],
    falta: [
      "Servidor da Evolution API com HTTPS e uma instância por número da empresa",
      "Rota de servidor para o webhook de mensagens recebidas, com conferência da chave",
      "Regra de quem pode enviar e vínculo do número do vendedor",
      "Tabela de conversas no banco (mensagem do Lovable)",
    ],
  },
  {
    chave: "email",
    nome: "E-mail (SMTP e IMAP)",
    descricao: "Enviar orçamentos por e-mail e ler respostas dos clientes.",
    segredos: [
      "SMTP_HOST",
      "SMTP_USUARIO",
      "SMTP_SENHA",
      "IMAP_HOST",
      "IMAP_USUARIO",
      "IMAP_SENHA",
    ],
    falta: [
      "Caixa de e-mail técnica da empresa (SMTP e IMAP com TLS)",
      "Rota de servidor que envia e uma tarefa agendada que lê a caixa",
      "Ligação do e-mail recebido ao cliente pelo endereço cadastrado",
    ],
  },
  {
    chave: "instagram",
    nome: "Instagram (API da Meta)",
    descricao: "Trazer os posts da conta corporativa para a gamificação, sem colar endereço à mão.",
    segredos: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_TOKEN"],
    falta: [
      "Conta profissional do Instagram ligada a uma página do Facebook",
      "Aplicativo na Meta aprovado para leitura de posts",
      "Renovação do token pelo servidor (expira em 60 dias)",
    ],
  },
];
