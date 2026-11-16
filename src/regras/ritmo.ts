import { diasUteisDecorridos, diasUteisDoMes, diasUteisRestantes, type Feriados } from "./datas";
import { atingimento, projecao } from "./metas";

export type StatusRitmo = "batida" | "no_ritmo" | "abaixo";

/** Escala da barra "Meta do mês": de 0 a 125% da meta. */
export const ESCALA_BARRA = 1.25;

/**
 * Ritmo do mês por dias úteis (feriados da tabela, fuso de Maceió via `hoje`):
 * onde o faturado deveria estar hoje, quanto falta, quanto render por dia útil e a projeção linear.
 */
export function calcularRitmo(input: {
  faturado: number;
  meta: number;
  hoje: Date;
  feriados: Feriados;
}) {
  const { faturado, meta, hoje, feriados } = input;
  const total = diasUteisDoMes(hoje, feriados);
  const decorridos = diasUteisDecorridos(hoje, feriados);
  const restantes = diasUteisRestantes(hoje, feriados);
  const atingido = atingimento(faturado, meta);
  const ritmo = total > 0 ? Math.min(1, decorridos / total) : 0;
  const concluido = restantes === 0;
  const falta = Math.max(0, meta - faturado);
  const proj = projecao(faturado, hoje, feriados);
  const status: StatusRitmo = atingido >= 1 ? "batida" : atingido < ritmo ? "abaixo" : "no_ritmo";
  return {
    atingido,
    ritmo,
    concluido,
    falta,
    restantes,
    ritmoNecessario: restantes > 0 ? falta / restantes : 0,
    projecao: proj,
    projecaoPct: atingimento(proj, meta),
    status,
  };
}
