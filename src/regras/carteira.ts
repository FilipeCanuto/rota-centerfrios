import type { ConfiguracaoRegras } from "./configuracoes";
import { diasEntre, diasUteisDesde, paraData, type Feriados } from "./datas";

export type TipoInteracao = "whatsapp" | "ligacao" | "visita" | "outro";

export interface Interacao {
  cliente_id: string;
  tipo: TipoInteracao;
  cliente_respondeu: boolean;
  resultado: string | null;
  data: string;
}

/**
 * Interação qualificada: o cliente respondeu, ou visita/ligação com resultado.
 * Mensagem sem resposta não conta. (A mesma definição está em painel_vendedor no banco.)
 */
export function interacaoQualificada(i: Pick<Interacao, "tipo" | "cliente_respondeu" | "resultado">): boolean {
  if (i.cliente_respondeu) return true;
  if ((i.tipo === "visita" || i.tipo === "ligacao") && !!i.resultado?.trim()) return true;
  return false;
}

/** Última data com interação qualificada OU compra faturada: compra também é contato qualificado. */
export function ultimaInteracaoQualificada(ultimaInteracao: string | null, ultimaCompra: string | null): string | null {
  const datas = [ultimaInteracao, ultimaCompra].filter((d): d is string => !!d).map((d) => d.slice(0, 10));
  return datas.length ? datas.sort().at(-1)! : null;
}

/** Cobertura = clientes com compra ou interação qualificada no mês ÷ clientes da carteira. Carteira vazia → 0. */
export function cobertura(clientes: { comprou_no_mes: boolean; qualificada_no_mes: boolean }[]): {
  cobertos: number;
  total: number;
  percentual: number;
} {
  const total = clientes.length;
  const cobertos = clientes.filter((c) => c.comprou_no_mes || c.qualificada_no_mes).length;
  return { cobertos, total, percentual: total ? cobertos / total : 0 };
}

export type StatusRecompra = "em_dia" | "atencao" | "urgente" | "sem_historico";

/** Intervalo médio em dias entre compras (precisa do mínimo de compras configurado; compras no mesmo dia contam uma vez). */
export function intervaloMedioCompras(datas: string[], minimo: number): number | null {
  const unicas = [...new Set(datas.map((d) => d.slice(0, 10)))].sort();
  if (unicas.length < minimo || unicas.length < 2) return null;
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

/** Cliente esquecido: sem interação qualificada (ou compra) há N dias ou mais, ou nunca. */
export function clienteEsquecido(ultimaQualificada: string | null, hoje: Date, cfg: ConfiguracaoRegras): boolean {
  if (!ultimaQualificada) return true;
  return diasEntre(paraData(ultimaQualificada), hoje) >= cfg.cliente_esquecido_dias;
}

/** Cliente sem compra há N dias ou mais (ou nunca comprou): pode ser remanejado pelo supervisor. */
export function clienteSemCompra(ultimaCompra: string | null, hoje: Date, cfg: ConfiguracaoRegras): boolean {
  if (!ultimaCompra) return true;
  return diasEntre(paraData(ultimaCompra), hoje) >= cfg.cliente_sem_compra_dias;
}

/** Orçamento parado: N dias úteis completos sem interação. */
export function orcamentoParado(ultimaAtividade: string, hoje: Date, cfg: ConfiguracaoRegras, feriados: Feriados): boolean {
  return diasUteisDesde(paraData(ultimaAtividade), hoje, feriados) >= cfg.orcamento_parado_dias_uteis;
}
