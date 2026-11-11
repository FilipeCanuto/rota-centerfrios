import { formatarISO, paraData } from "./datas";

export const MENCAO_INSTAGRAM = "@centerfriosoficial";

export const INDICADORES: Record<string, string> = {
  vendas: "Vendas",
  cobertura: "Cobertura",
  reativacao: "Reativação",
  orcamentos: "Orçamentos",
  instagram: "Instagram",
};

/** Temporada = o mês: do dia 1º ao último dia. */
export function periodoMes(hojeISO: string): [string, string] {
  const d = paraData(hojeISO);
  return [
    formatarISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    formatarISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  ];
}

/** Semana = segunda a domingo. */
export function periodoSemana(hojeISO: string): [string, string] {
  const d = paraData(hojeISO);
  const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const dom = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 6);
  return [formatarISO(seg), formatarISO(dom)];
}

/** Mesma checagem do banco, para avisar antes de enviar; quem decide é o servidor. */
export function legendaValida(legenda: string, hashtag: string): boolean {
  const l = legenda.toLowerCase();
  const tag = hashtag.trim().toLowerCase();
  return l.includes(MENCAO_INSTAGRAM) || (tag !== "" && l.includes(tag));
}
