import { orcamentoParado } from "./carteira";
import type { ConfiguracaoRegras } from "./configuracoes";
import type { Feriados } from "./datas";

export interface OrcamentoLinha {
  status: string;
  data: string;
  ultimo_followup: string | null;
  proximo_followup: string | null;
}

/** Só orçamento aberto pode estar parado (mesmo limite do Início) ou ter retorno atrasado. */
export function situacaoOrcamento(
  o: OrcamentoLinha,
  hojeISO: string,
  hoje: Date,
  cfg: ConfiguracaoRegras,
  feriados: Feriados,
): { parado: boolean; retornoAtrasado: boolean } {
  if (o.status !== "aberto") return { parado: false, retornoAtrasado: false };
  return {
    parado: orcamentoParado(o.ultimo_followup ?? o.data, hoje, cfg, feriados),
    retornoAtrasado: !!o.proximo_followup && o.proximo_followup < hojeISO,
  };
}
