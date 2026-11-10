import type { ConfiguracaoRegras } from "./configuracoes";
import { diasEntre, diasUteisDesde, paraData } from "./datas";

export type TipoInteracao = "whatsapp" | "ligacao" | "visita" | "outro";

export interface Interacao {
  cliente_id: string;
  tipo: TipoInteracao;
  cliente_respondeu: boolean;
  resultado: string | null;
  data: string;
}

export interface Venda {
  cliente_id: string;
  data_faturamento: string;
}

/**
 * Interação qualificada: o cliente respondeu, ou visita/ligação com resultado.
 * Mensagem sem resposta não conta.
 */
export function interacaoQualificada(i: Pick<Interacao, "tipo" | "cliente_respondeu" | "resultado">): boolean {
  if (i.cliente_respondeu) return true;
  if ((i.tipo === "visita" || i.tipo === "ligacao") && !!i.resultado?.trim()) return true;
  return false;
}

/**
 * Cobertura = clientes da carteira com interação qualificada no mês (ou compra faturada no mês)
 * ÷ clientes da carteira.
 */
export function cobertura(
  clientesIds: string[],
  interacoesDoMes: Pick<Interacao, "cliente_id" | "tipo" | "cliente_respondeu" | "resultado">[],
  vendasDoMes: Pick<Venda, "cliente_id">[],
): { cobertos: number; total: number; percentual: number } {
  const carteira = new Set(clientesIds);
  const cobertos = new Set<string>();
  for (const i of interacoesDoMes) if (carteira.has(i.cliente_id) && interacaoQualificada(i)) cobertos.add(i.cliente_id);
  for (const v of vendasDoMes) if (carteira.has(v.cliente_id)) cobertos.add(v.cliente_id);
  const total = carteira.size;
  return { cobertos: cobertos.size, total, percentual: total ? cobertos.size / total : 0 };
}

export type StatusRecompra = "em_dia" | "atencao" | "urgente" | "sem_historico";

/** Intervalo médio em dias entre compras (precisa do mínimo de compras configurado). */
export function intervaloMedioCompras(datas: string[], minimo: number): number | null {
  const unicas = [...new Set(datas.map((d) => d.slice(0, 10)))].sort();
  if (unicas.length < minimo) return null;
  const total = diasEntre(paraData(unicas[0]!), paraData(unicas[unicas.length - 1]!));
  return total / (unicas.length - 1);
}

export function statusRecompra(datasCompras: string[], hoje: Date, cfg: ConfiguracaoRegras): {
  status: StatusRecompra;
  intervaloMedio: number | null;
  diasDesdeUltima: number | null;
} {
  const intervalo = intervaloMedioCompras(datasCompras, cfg.recompra_minimo_compras);
  if (intervalo === null || intervalo <= 0) return { status: "sem_historico", intervaloMedio: intervalo, diasDesdeUltima: null };
  const ultima = [...datasCompras].sort().at(-1)!;
  const dias = diasEntre(paraData(ultima), hoje);
  let status: StatusRecompra = "em_dia";
  if (dias >= intervalo * cfg.recompra_fator_urgente) status = "urgente";
  else if (dias >= intervalo * cfg.recompra_fator_atencao) status = "atencao";
  return { status, intervaloMedio: intervalo, diasDesdeUltima: dias };
}

/** Cliente esquecido: sem interação qualificada há N dias ou mais (ou nunca). */
export function clienteEsquecido(
  ultimaQualificada: string | null,
  hoje: Date,
  cfg: ConfiguracaoRegras,
): boolean {
  if (!ultimaQualificada) return true;
  return diasEntre(paraData(ultimaQualificada), hoje) >= cfg.cliente_esquecido_dias;
}

/** Cliente sem compra há N dias ou mais: pode ser remanejado pelo supervisor. */
export function clienteSemCompra(ultimaCompra: string | null, hoje: Date, cfg: ConfiguracaoRegras): boolean {
  if (!ultimaCompra) return true;
  return diasEntre(paraData(ultimaCompra), hoje) >= cfg.cliente_sem_compra_dias;
}

/** Orçamento parado: N dias úteis sem interação. */
export function orcamentoParado(ultimaAtividade: string, hoje: Date, cfg: ConfiguracaoRegras): boolean {
  return diasUteisDesde(paraData(ultimaAtividade), hoje) >= cfg.orcamento_parado_dias_uteis;
}
