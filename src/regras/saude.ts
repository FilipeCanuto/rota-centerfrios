import {
  clienteEsquecido,
  clienteSemCompra,
  statusRecompra,
  ultimaInteracaoQualificada,
} from "./carteira";
import type { ConfiguracaoRegras } from "./configuracoes";

export type SaudeCliente = "saudavel" | "atencao" | "em_risco";

/**
 * Saúde do cliente, só com limites já aprovados (configuracoes_regras):
 * - em risco: sem compra há `cliente_sem_compra_dias` ou mais, ou recompra urgente;
 * - atenção: recompra em atenção ou cliente esquecido;
 * - saudável: o resto.
 * Valor de compra ainda não entra (o plano cita recência, frequência e valor, sem faixas de valor definidas).
 */
export function saudeCliente(
  c: { compras: string[]; ultima_interacao_qualificada: string | null },
  hoje: Date,
  cfg: ConfiguracaoRegras,
): SaudeCliente {
  const ultimaCompra = c.compras.length ? [...c.compras].sort().at(-1)! : null;
  const recompra = statusRecompra(c.compras, hoje, cfg).status;
  if (clienteSemCompra(ultimaCompra, hoje, cfg) || recompra === "urgente") return "em_risco";
  const qualificada = ultimaInteracaoQualificada(c.ultima_interacao_qualificada, ultimaCompra);
  if (recompra === "atencao" || clienteEsquecido(qualificada, hoje, cfg)) return "atencao";
  return "saudavel";
}
