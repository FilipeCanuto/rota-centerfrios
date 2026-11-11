/** Utilidades de datas puras. Datas de calendário como "AAAA-MM-DD", no fuso de Maceió. */

export const FUSO = "America/Maceio";

/** Datas não úteis (feriados e dias sem expediente), em "AAAA-MM-DD". Todas as abrangências contam igual. */
export type Feriados = ReadonlySet<string>;

export function paraData(v: string | Date): Date {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const [a = 1970, m = 1, d = 1] = v.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function formatarISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const diaLocal = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia de calendário em Maceió de um instante (timestamptz do banco ou Date). Nunca use toISOString().slice(0, 10). */
export function dataLocal(instante: string | Date): string {
  return diaLocal.format(typeof instante === "string" ? new Date(instante) : instante);
}

/** Hoje em Maceió, como data local (sem horário). */
export function hojeEmMaceio(agora: Date = new Date()): Date {
  return paraData(dataLocal(agora));
}

export function diasEntre(inicio: Date, fim: Date): number {
  const ms = paraData(fim).getTime() - paraData(inicio).getTime();
  return Math.round(ms / 86_400_000);
}

export function ehDiaUtil(d: Date, feriados: Feriados): boolean {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6 && !feriados.has(formatarISO(d));
}

/** Dias úteis no intervalo fechado [inicio, fim]. */
export function diasUteisEntre(inicio: Date, fim: Date, feriados: Feriados): number {
  const a = paraData(inicio);
  const b = paraData(fim);
  if (b < a) return 0;
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) if (ehDiaUtil(d, feriados)) n++;
  return n;
}

export function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function fimDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function diasUteisDoMes(hoje: Date, feriados: Feriados): number {
  return diasUteisEntre(inicioDoMes(hoje), fimDoMes(hoje), feriados);
}
/** Dias úteis decorridos no mês, incluindo hoje se for dia útil. */
export function diasUteisDecorridos(hoje: Date, feriados: Feriados): number {
  return diasUteisEntre(inicioDoMes(hoje), hoje, feriados);
}
/** Dias úteis restantes no mês, incluindo hoje se for dia útil. */
export function diasUteisRestantes(hoje: Date, feriados: Feriados): number {
  return diasUteisEntre(hoje, fimDoMes(hoje), feriados);
}

/** Dias úteis completos depois de `desde` até `hoje` (sem contar o dia inicial). */
export function diasUteisDesde(desde: Date, hoje: Date, feriados: Feriados): number {
  const a = paraData(desde);
  a.setDate(a.getDate() + 1);
  return diasUteisEntre(a, hoje, feriados);
}

/** Monta o conjunto de feriados que vale para uma empresa (nulo = vale para todas). */
export function feriadosDaEmpresa(
  linhas: { data: string; empresa_id: string | null }[],
  empresaId: string,
): Feriados {
  return new Set(
    linhas
      .filter((l) => l.empresa_id === null || l.empresa_id === empresaId)
      .map((l) => l.data.slice(0, 10)),
  );
}
