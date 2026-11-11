import { orcamentoParado } from "./carteira";
import type { ConfiguracaoRegras } from "./configuracoes";
import { diasUteisDecorridos, diasUteisDoMes, type Feriados } from "./datas";

/** Uma linha de painel_gestao (migração 0018). */
export interface LinhaGestao {
  vendedor_id: string;
  nome: string;
  equipe: string | null;
  meta: { meta_vendas: number; meta_cobertura: number } | null;
  faturado_mes: number;
  faturado_hoje: number;
  clientes_total: number;
  clientes_cobertos: number;
  orcamentos_abertos: {
    id: string;
    valor: number;
    data: string;
    ultimo_followup: string | null;
    ultima_interacao: string | null;
  }[];
  clientes_sem_compra_90: number;
  esquecidos: number;
}

export interface ResumoGestao {
  /** Faturado ÷ meta do mês; nulo sem meta. */
  atingimento: number | null;
  /** Parte da meta que já deveria ter sido feita pelos dias úteis decorridos; nulo sem meta. */
  esperado: number | null;
  /** Clientes cobertos ÷ carteira; nulo com carteira vazia. */
  cobertura: number | null;
  orcamentosParados: number;
}

export function resumirVendedor(
  l: LinhaGestao,
  hoje: Date,
  cfg: ConfiguracaoRegras,
  feriados: Feriados,
): ResumoGestao {
  const meta = Number(l.meta?.meta_vendas ?? 0);
  const total = diasUteisDoMes(hoje, feriados);
  return {
    atingimento: meta > 0 ? Number(l.faturado_mes) / meta : null,
    esperado: meta > 0 && total > 0 ? diasUteisDecorridos(hoje, feriados) / total : null,
    cobertura: l.clientes_total > 0 ? l.clientes_cobertos / l.clientes_total : null,
    // Mesmo critério do Início: último retorno (ou a data) e o último contato com o cliente.
    orcamentosParados: l.orcamentos_abertos.filter((o) =>
      orcamentoParado(
        [o.ultimo_followup ?? o.data, o.ultima_interacao ?? ""].sort().at(-1)!,
        hoje,
        cfg,
        feriados,
      ),
    ).length,
  };
}

/** Soma da equipe: faturado e meta somados; o atingimento é da soma, não a média dos percentuais. */
export function somarEquipe(linhas: LinhaGestao[]) {
  const soma = (f: (l: LinhaGestao) => number) => linhas.reduce((t, l) => t + f(l), 0);
  const meta = soma((l) => Number(l.meta?.meta_vendas ?? 0));
  const faturado = soma((l) => Number(l.faturado_mes));
  return {
    meta,
    faturado,
    faturadoHoje: soma((l) => Number(l.faturado_hoje)),
    atingimento: meta > 0 ? faturado / meta : null,
    clientesSemCompra: soma((l) => l.clientes_sem_compra_90),
    esquecidos: soma((l) => l.esquecidos),
  };
}
