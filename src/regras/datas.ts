/** Utilidades de datas puras (sem fuso: trabalhamos com datas locais "AAAA-MM-DD"). */
export function paraData(v: string | Date): Date {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const [a, m, d] = v.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function diasEntre(inicio: Date, fim: Date): number {
  const ms = paraData(fim).getTime() - paraData(inicio).getTime();
  return Math.round(ms / 86_400_000);
}

export function ehDiaUtil(d: Date): boolean {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6;
}

/** Dias úteis no intervalo fechado [inicio, fim]. */
export function diasUteisEntre(inicio: Date, fim: Date): number {
  const a = paraData(inicio);
  const b = paraData(fim);
  if (b < a) return 0;
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) if (ehDiaUtil(d)) n++;
  return n;
}

export function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function fimDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function diasUteisDoMes(hoje: Date): number {
  return diasUteisEntre(inicioDoMes(hoje), fimDoMes(hoje));
}
/** Dias úteis decorridos no mês, incluindo hoje se for dia útil. */
export function diasUteisDecorridos(hoje: Date): number {
  return diasUteisEntre(inicioDoMes(hoje), hoje);
}
/** Dias úteis restantes no mês, incluindo hoje se for dia útil. */
export function diasUteisRestantes(hoje: Date): number {
  return diasUteisEntre(hoje, fimDoMes(hoje));
}

/** Dias úteis completos entre duas datas, sem contar o dia inicial. */
export function diasUteisDesde(desde: Date, hoje: Date): number {
  const a = paraData(desde);
  a.setDate(a.getDate() + 1);
  return diasUteisEntre(a, hoje);
}

export function formatarISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
