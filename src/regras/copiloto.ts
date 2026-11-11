export type Expressao = "neutro" | "feliz" | "atento" | "comemorando";
export type VersaoPinguim = "consultor" | "panificador" | "acougueiro" | "pizzaiolo";

export const VERSOES_PINGUIM: { valor: VersaoPinguim; rotulo: string }[] = [
  { valor: "consultor", rotulo: "Consultor" },
  { valor: "panificador", rotulo: "Panificador" },
  { valor: "acougueiro", rotulo: "Açougueiro" },
  { valor: "pizzaiolo", rotulo: "Pizzaiolo" },
];

/** Expressão do Pinguim a partir do dia: meta batida comemora; pendências pedem atenção. */
export function expressaoDoCopiloto(c: {
  atingimento: number;
  clientesHoje: number;
  orcamentosParados: number;
}): Expressao {
  if (c.atingimento >= 1) return "comemorando";
  if (c.orcamentosParados > 0 || c.clientesHoje > 0) return "atento";
  return c.atingimento >= 0.7 ? "feliz" : "neutro";
}

/** Apelido do copiloto: de 2 a 20 caracteres, sem só espaços. */
export function apelidoValido(apelido: string): string | null {
  const a = apelido.trim();
  return a.length >= 2 && a.length <= 20 ? a : null;
}
