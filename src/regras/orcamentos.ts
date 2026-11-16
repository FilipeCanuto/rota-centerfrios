import { orcamentoParado, ultimaAtividadeOrcamento } from "./carteira";
import type { ConfiguracaoRegras } from "./configuracoes";
import type { Feriados } from "./datas";

export interface OrcamentoLinha {
  status: string;
  data: string;
  ultimo_followup: string | null;
  proximo_followup: string | null;
}

/**
 * Só orçamento aberto pode estar parado ou ter retorno atrasado. `ultimoContato` é o dia (Maceió) do
 * último contato com o cliente: conta como atividade, igual ao Início e à Gestão.
 */
export function situacaoOrcamento(
  o: OrcamentoLinha,
  hojeISO: string,
  hoje: Date,
  cfg: ConfiguracaoRegras,
  feriados: Feriados,
  ultimoContato: string | null = null,
): { parado: boolean; retornoAtrasado: boolean } {
  if (o.status !== "aberto") return { parado: false, retornoAtrasado: false };
  return {
    parado: orcamentoParado(ultimaAtividadeOrcamento(o, ultimoContato), hoje, cfg, feriados),
    retornoAtrasado: !!o.proximo_followup && o.proximo_followup < hojeISO,
  };
}
