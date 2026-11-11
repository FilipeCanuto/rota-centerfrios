import { diasUteisDecorridos, diasUteisDoMes, diasUteisRestantes, type Feriados } from "./datas";

/** Atingimento = vendas faturadas no mês ÷ meta do mês (0 a n). Meta zero → 0. */
export function atingimento(faturadoMes: number, metaMes: number): number {
  if (metaMes <= 0) return 0;
  return faturadoMes / metaMes;
}

/** Projeção = faturado até hoje ÷ dias úteis decorridos × dias úteis do mês. Sem dia útil decorrido → o próprio faturado. */
export function projecao(faturadoAteHoje: number, hoje: Date, feriados: Feriados): number {
  const decorridos = diasUteisDecorridos(hoje, feriados);
  if (decorridos <= 0) return faturadoAteHoje;
  return (faturadoAteHoje / decorridos) * diasUteisDoMes(hoje, feriados);
}

/** Meta do dia = (meta do mês − faturado até ontem) ÷ dias úteis restantes. Nunca negativa; sem dia útil restante → tudo o que falta. */
export function metaDoDia(
  metaMes: number,
  faturadoAteOntem: number,
  hoje: Date,
  feriados: Feriados,
): number {
  const restantes = diasUteisRestantes(hoje, feriados);
  const falta = Math.max(0, metaMes - faturadoAteOntem);
  if (restantes <= 0) return falta;
  return falta / restantes;
}

/**
 * Meta diária de cobertura = (meta mensal de cobertura − cobertura atingida) ÷ dias úteis restantes,
 * em número de clientes, arredondada para cima. `metaPercentual` vem em pontos (70 = 70%). Meta já atingida → 0.
 */
export function metaDiariaCobertura(
  metaPercentual: number,
  cobertos: number,
  total: number,
  hoje: Date,
  feriados: Feriados,
): number {
  if (total <= 0) return 0;
  const falta = Math.max(0, Math.ceil((metaPercentual / 100) * total) - cobertos);
  if (falta === 0) return 0;
  return Math.ceil(falta / Math.max(1, diasUteisRestantes(hoje, feriados)));
}
