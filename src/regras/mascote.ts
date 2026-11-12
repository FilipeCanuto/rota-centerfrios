/** Regras puras do mascote: estados, fila de balões e encaixe na tela. Sem React, sem rede. */

/** Mapa único de estados. Estado novo = uma linha aqui (ver docs/mascote.md). */
export const ESTADOS_MASCOTE = {
  neutro: { rotulo: "Tranquilo", som: null },
  feliz: { rotulo: "Feliz", som: null },
  comemorando: { rotulo: "Comemorando", som: "conquista" },
  atento: { rotulo: "Atento", som: null },
  preocupado: { rotulo: "Preocupado", som: "alerta" },
  pensando: { rotulo: "Pensando", som: null },
  incentivo: { rotulo: "Incentivando", som: null },
  descanso: { rotulo: "Descansando", som: null },
  erro: { rotulo: "Algo deu errado", som: "erro" },
} as const satisfies Record<
  string,
  { rotulo: string; som: "conquista" | "alerta" | "erro" | null }
>;

export type EstadoMascote = keyof typeof ESTADOS_MASCOTE;

/** Estado desconhecido (vindo de dado antigo ou de função nova) cai em neutro, sem quebrar. */
export function normalizarEstado(estado: unknown): EstadoMascote {
  return typeof estado === "string" && Object.hasOwn(ESTADOS_MASCOTE, estado)
    ? (estado as EstadoMascote)
    : "neutro";
}

export type Prioridade = "urgente" | "importante" | "informativo";
const PESO: Record<Prioridade, number> = { urgente: 0, importante: 1, informativo: 2 };

export interface Fala {
  id: string;
  tipo: string;
  prioridade: Prioridade;
  texto: string;
  estado?: EstadoMascote | undefined;
  acao?: { rotulo: string; link: string } | undefined;
  /** Instante (ms) depois do qual a fala não faz mais sentido. */
  expiraEm?: number | undefined;
}

export interface FilaMascote {
  pendentes: Fala[];
  /** Ids já aceitos nesta sessão: a mesma fala nunca entra duas vezes. */
  vistos: string[];
  /** Instante (ms) do último balão mostrado. */
  ultimoBalao: number;
}

export const FILA_VAZIA: FilaMascote = { pendentes: [], vistos: [], ultimoBalao: 0 };

/** Põe a fala na fila por prioridade (empate: ordem de chegada). Repetida por id é ignorada. */
export function enfileirar(fila: FilaMascote, fala: Fala): FilaMascote {
  if (fila.vistos.includes(fala.id)) return fila;
  const pendentes = [...fila.pendentes, { ...fala, prioridade: prioridadeValida(fala.prioridade) }];
  pendentes.sort((a, b) => PESO[a.prioridade] - PESO[b.prioridade]);
  return { ...fila, pendentes, vistos: [...fila.vistos, fala.id] };
}

function prioridadeValida(p: unknown): Prioridade {
  return p === "urgente" || p === "importante" ? p : "informativo";
}

/**
 * Próxima fala a mostrar agora, ou null se ainda não pode. Descarta as vencidas.
 * Urgente fura o limite de frequência; as outras esperam `intervaloMs` desde o último balão.
 */
export function proximaFala(
  fila: FilaMascote,
  agora: number,
  intervaloMs: number,
): { fala: Fala | null; fila: FilaMascote } {
  const pendentes = fila.pendentes.filter((f) => !f.expiraEm || f.expiraEm > agora);
  const [primeira] = pendentes;
  const liberada =
    primeira &&
    (primeira.prioridade === "urgente" ||
      !fila.ultimoBalao ||
      agora - fila.ultimoBalao >= intervaloMs);
  if (!liberada) return { fala: null, fila: { ...fila, pendentes } };
  return { fala: primeira, fila: { ...fila, pendentes: pendentes.slice(1), ultimoBalao: agora } };
}

/** Quanto falta (ms) para a próxima fala poder aparecer; 0 se já pode, null se a fila está vazia. */
export function esperaDaFila(fila: FilaMascote, agora: number, intervaloMs: number): number | null {
  const [primeira] = fila.pendentes;
  if (!primeira) return null;
  if (primeira.prioridade === "urgente" || !fila.ultimoBalao) return 0;
  return Math.max(0, fila.ultimoBalao + intervaloMs - agora);
}

/** Tempo do balão na tela, proporcional ao texto, com piso para dar tempo de ler. */
export function permanenciaMs(texto: string, msPorCaractere: number, minimoMs: number): number {
  return Math.max(minimoMs, texto.length * msPorCaractere);
}

/** Horário de trabalho da pessoa (preferencias_notificacao). Horas em "HH:MM". */
export interface Expediente {
  inicio: string;
  fim: string;
  /** Nulo = sem expediente no sábado. */
  sabadoInicio: string | null;
  sabadoFim: string | null;
}
export const EXPEDIENTE_PADRAO: Expediente = {
  inicio: "08:00",
  fim: "18:00",
  sabadoInicio: "08:00",
  sabadoFim: "12:00",
};

/** Fora do expediente: domingo, feriado, sábado sem horário ou hora fora de [início, fim). */
export function foraDoExpediente(
  hora: string,
  diaDaSemana: number,
  feriado: boolean,
  e: Expediente,
): boolean {
  if (feriado || diaDaSemana === 0) return true;
  const [inicio, fim] = diaDaSemana === 6 ? [e.sabadoInicio, e.sabadoFim] : [e.inicio, e.fim];
  if (!inicio || !fim) return true;
  const h = hora.slice(0, 5);
  return h < inicio.slice(0, 5) || h >= fim.slice(0, 5);
}

/**
 * Máquina de estados: o que o mascote mostra agora. Ordem: a fala na tela manda; depois um estado
 * pedido por definirEstado (temporário); depois "pensando" enquanto algo carrega; por fim o
 * descanso fora do expediente ou o neutro.
 */
export function estadoEfetivo(c: {
  fala?: string | null;
  temporario?: string | null;
  ocupado?: boolean;
  foraDoExpediente?: boolean;
}): EstadoMascote {
  if (c.fala) return normalizarEstado(c.fala);
  if (c.temporario) return normalizarEstado(c.temporario);
  if (c.ocupado) return "pensando";
  return c.foraDoExpediente ? "descanso" : "neutro";
}

export type Canto =
  "inferior-direito" | "inferior-esquerdo" | "superior-direito" | "superior-esquerdo";
export const CANTOS: { valor: Canto; rotulo: string }[] = [
  { valor: "inferior-direito", rotulo: "Canto inferior direito" },
  { valor: "inferior-esquerdo", rotulo: "Canto inferior esquerdo" },
  { valor: "superior-direito", rotulo: "Canto superior direito" },
  { valor: "superior-esquerdo", rotulo: "Canto superior esquerdo" },
];

/** Canto mais próximo do ponto onde o mascote foi solto (centro dele). */
export function cantoMaisProximo(x: number, y: number, largura: number, altura: number): Canto {
  return `${y < altura / 2 ? "superior" : "inferior"}-${x < largura / 2 ? "esquerdo" : "direito"}`;
}

export function cantoValido(canto: unknown): Canto {
  return CANTOS.find((c) => c.valor === canto)?.valor ?? "inferior-direito";
}
