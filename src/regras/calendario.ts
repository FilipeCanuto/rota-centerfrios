import { formatarISO, paraData } from "./datas";

export type TipoEvento = "agendamento" | "retorno" | "orcamento" | "recompra" | "feriado";

export interface EventoCalendario {
  id: string;
  /** Dia no calendário de Maceió (AAAA-MM-DD). */
  dia: string;
  tipo: TipoEvento;
  titulo: string;
  detalhe?: string | undefined;
  clienteId?: string | null | undefined;
}

export const somarDias = (iso: string, n: number) => {
  const d = paraData(iso);
  d.setDate(d.getDate() + n);
  return formatarISO(d);
};

/** Soma meses mantendo o dia, ou o último dia do mês quando ele não existe (31 → 30, 29/02). */
export function somarMeses(iso: string, n: number): string {
  const d = paraData(iso);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return formatarISO(d);
}

/** Segunda-feira da semana da data. */
export const inicioSemana = (iso: string) => somarDias(iso, -((paraData(iso).getDay() + 6) % 7));

/** Dias exibidos no mês: semanas completas, de segunda a domingo (35 ou 42 datas). */
export function gradeDoMes(iso: string): string[] {
  const d = paraData(iso);
  const primeiro = formatarISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const ultimo = formatarISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const ini = inicioSemana(primeiro);
  const fim = somarDias(inicioSemana(ultimo), 6);
  const dias: string[] = [];
  for (let x = ini; x <= fim; x = somarDias(x, 1)) dias.push(x);
  return dias;
}

export function agruparPorDia(eventos: EventoCalendario[]): Map<string, EventoCalendario[]> {
  const m = new Map<string, EventoCalendario[]>();
  for (const e of eventos) m.set(e.dia, [...(m.get(e.dia) ?? []), e]);
  return m;
}

/** Tipos presentes no dia, na ordem fixa da legenda (para os ícones da célula). */
export const ORDEM_TIPOS: TipoEvento[] = [
  "feriado",
  "agendamento",
  "retorno",
  "orcamento",
  "recompra",
];
export function tiposDoDia(eventos: EventoCalendario[]): TipoEvento[] {
  return ORDEM_TIPOS.filter((t) => eventos.some((e) => e.tipo === t));
}
