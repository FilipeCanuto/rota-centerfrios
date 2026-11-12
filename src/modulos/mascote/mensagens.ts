import type { EstadoMascote, Prioridade } from "@/regras";

/**
 * TODOS os textos do mascote ficam aqui. Tom: curto e acionável, até ~90 caracteres, com o
 * apelido que o vendedor escolheu. Para criar uma fala nova, acrescente uma entrada (docs/mascote.md).
 */
interface Modelo {
  tipo: string;
  prioridade: Prioridade;
  estado: EstadoMascote;
  texto: (apelido: string, n: number) => string;
  acao?: { rotulo: string; link: string };
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export const MENSAGENS = {
  meta_batida: {
    tipo: "meta",
    prioridade: "importante",
    estado: "comemorando",
    texto: (a) => `${a} aqui: meta do mês batida! Parabéns, você mandou muito bem.`,
    acao: { rotulo: "Ver conquistas", link: "/gamificacao" },
  },
  meta_perto: {
    tipo: "meta",
    prioridade: "informativo",
    estado: "incentivo",
    texto: (a, n) => `${a} aqui: você já fez ${n}% da meta. Falta pouco, bora fechar!`,
  },
  cliente_esquecido: {
    tipo: "esquecido",
    prioridade: "importante",
    estado: "atento",
    texto: (a, n) =>
      `${a} aqui: ${n} ${plural(n, "cliente está", "clientes estão")} sem contato há um tempo. Vamos retomar?`,
    acao: { rotulo: "Ver clientes", link: "/inicio#alertas" },
  },
  orcamento_parado: {
    tipo: "orcamento_parado",
    prioridade: "importante",
    estado: "atento",
    texto: (a, n) =>
      `${a} aqui: ${n} ${plural(n, "orçamento parado", "orçamentos parados")}. Um retorno hoje pode fechar.`,
    acao: { rotulo: "Ver orçamentos", link: "/orcamentos" },
  },
  recompra_atrasada: {
    tipo: "recompra",
    prioridade: "urgente",
    estado: "preocupado",
    texto: (a, n) =>
      `${a} aqui: ${n} ${plural(n, "cliente passou", "clientes passaram")} muito da hora de recomprar.`,
    acao: { rotulo: "Ver agora", link: "/inicio#alertas" },
  },
} satisfies Record<string, Modelo>;

export type ChaveMensagem = keyof typeof MENSAGENS;

/** Monta a fala pronta para `notificar`. O id decide a repetição: mesmo id, mesma fala. */
export function mensagem(chave: ChaveMensagem, id: string, apelido: string, n = 0) {
  const m: Modelo = MENSAGENS[chave];
  return {
    id,
    tipo: m.tipo,
    prioridade: m.prioridade,
    estado: m.estado,
    texto: m.texto(apelido, n),
    acao: m.acao,
  };
}

/**
 * Notificações que o banco grava (pontos, selos, metas, vendas…) também viram reação: o tipo da
 * notificação escolhe o estado. Tipo novo sem entrada aqui é falado em tom neutro.
 */
type Reacao = { estado: EstadoMascote; prioridade: Prioridade };
export const REACAO_PADRAO: Reacao = { estado: "neutro", prioridade: "informativo" };
export const REACAO_POR_TIPO: Record<string, Reacao> = {
  meta: { estado: "comemorando", prioridade: "importante" },
  selo: { estado: "comemorando", prioridade: "importante" },
  pontos: { estado: "feliz", prioridade: "informativo" },
  venda: { estado: "feliz", prioridade: "informativo" },
  instagram: { estado: "feliz", prioridade: "informativo" },
  tarefa: { estado: "atento", prioridade: "informativo" },
};
/** Tipos que o Início já resume numa fala só (para não repetir um balão por cliente). */
export const TIPOS_RESUMIDOS = ["recompra", "orcamento_parado", "esquecido"];

/** Rótulos da interface do mascote. */
export const ROTULOS = {
  menu: (apelido: string) => `Menu do mascote ${apelido}`,
  restaurar: (apelido: string) => `Mostrar o mascote ${apelido}`,
  fechar: "Fechar o balão",
  moverPara: "Mover para",
  minimizar: "Minimizar",
  ocultarBaloes: "Ocultar balões",
  mostrarBaloes: "Mostrar balões",
  silenciar: "Silenciar sons",
  ativarSons: "Ativar sons",
};
