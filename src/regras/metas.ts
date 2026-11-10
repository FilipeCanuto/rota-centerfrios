import { diasUteisDecorridos, diasUteisDoMes, diasUteisRestantes } from "./datas";

/** Atingimento = vendas faturadas no mês ÷ meta do mês (0 a n). */
export function atingimento(faturadoMes: number, metaMes: number): number {
  if (metaMes <= 0) return 0;
  return faturadoMes / metaMes;
}

/** Projeção = faturado até hoje ÷ dias úteis decorridos × dias úteis do mês. */
export function projecao(faturadoAteHoje: number, hoje: Date): number {
  const decorridos = diasUteisDecorridos(hoje);
  if (decorridos <= 0) return faturadoAteHoje;
  return (faturadoAteHoje / decorridos) * diasUteisDoMes(hoje);
}

/** Meta do dia = (meta do mês − faturado até ontem) ÷ dias úteis restantes. */
export function metaDoDia(metaMes: number, faturadoAteOntem: number, hoje: Date): number {
  const restantes = diasUteisRestantes(hoje);
  const falta = Math.max(0, metaMes - faturadoAteOntem);
  if (restantes <= 0) return falta;
  return falta / restantes;
}
