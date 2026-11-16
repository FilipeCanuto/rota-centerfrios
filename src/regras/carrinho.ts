/**
 * Carrinho e orçamento da Rota. Espelho puro das regras que o banco aplica
 * (as funções de servidor são a fonte da verdade; aqui ficam para teste e para a tela pré-validar).
 * Dinheiro em centavos inteiros; arredondamento meio-para-cima (igual a ROUND(numeric, 2) do Postgres para valores positivos).
 */

export type EstadoCarrinho = "aberto" | "concluido" | "cancelado";
export type EstadoEnvio = "pendente" | "enviado" | "erro" | "confirmado";

/** Reais → centavos, arredondando meio-para-cima (0,005 → 0,01). */
export function emCentavos(reais: number): number {
  return Math.sign(reais) * Math.round(Math.abs(reais) * 100 + 1e-9);
}

/** Total do item: preço × quantidade × (1 − desconto%), arredondado a centavos por item. */
export function totalItemCentavos(precoUnit: number, quantidade: number, descontoPct = 0): number {
  if (quantidade <= 0) throw new Error("Quantidade deve ser maior que zero.");
  if (descontoPct < 0 || descontoPct > 100) throw new Error("Desconto fora de 0 a 100%.");
  return emCentavos(precoUnit * quantidade * (1 - descontoPct / 100));
}

/** Total do carrinho = soma dos itens já arredondados (nunca arredonda a soma de novo). */
export function totalCarrinhoCentavos(
  itens: readonly { preco_unit: number; quantidade: number; desconto_pct?: number }[],
): number {
  return itens.reduce(
    (s, i) => s + totalItemCentavos(i.preco_unit, i.quantidade, i.desconto_pct ?? 0),
    0,
  );
}

export interface CarrinhoResumo {
  vendedor_id: string;
  cliente_id: string;
  estado: EstadoCarrinho;
}

export type ResultadoAbrir =
  { ok: true } | { ok: false; motivo: "limite_vendedor" | "cliente_ja_tem_aberto" };

/** Até `max` carrinhos abertos por vendedor e 1 aberto por cliente por vendedor. */
export function podeAbrirCarrinho(
  carrinhos: readonly CarrinhoResumo[],
  vendedorId: string,
  clienteId: string,
  max: number,
): ResultadoAbrir {
  const abertos = carrinhos.filter((c) => c.vendedor_id === vendedorId && c.estado === "aberto");
  if (abertos.some((c) => c.cliente_id === clienteId))
    return { ok: false, motivo: "cliente_ja_tem_aberto" };
  if (abertos.length >= max) return { ok: false, motivo: "limite_vendedor" };
  return { ok: true };
}

/**
 * Modelo da trava do servidor: pedidos simultâneos são serializados (advisory lock por vendedor)
 * e cada um reavalia o limite já com os anteriores gravados.
 */
export function abrirEmSerie(
  inicial: readonly CarrinhoResumo[],
  pedidos: readonly { vendedor_id: string; cliente_id: string }[],
  max: number,
): { carrinhos: CarrinhoResumo[]; resultados: ResultadoAbrir[] } {
  const carrinhos = [...inicial];
  const resultados = pedidos.map((p) => {
    const r = podeAbrirCarrinho(carrinhos, p.vendedor_id, p.cliente_id, max);
    if (r.ok) carrinhos.push({ ...p, estado: "aberto" });
    return r;
  });
  return { carrinhos, resultados };
}

export interface Liberacao {
  desconto_pct: number;
  estado: "pendente" | "aprovada" | "negada";
  valida_ate: string; // ISO
}

export type ResultadoDesconto = { ok: true } | { ok: false; motivo: "precisa_liberacao" };

/** Desconto até o limite do vendedor passa; acima, só com liberação aprovada, vigente e que cubra o %. */
export function validarDesconto(
  descontoPct: number,
  limitePct: number,
  liberacoes: readonly Liberacao[],
  agoraISO: string,
): ResultadoDesconto {
  if (descontoPct <= limitePct) return { ok: true };
  const coberto = liberacoes.some(
    (l) => l.estado === "aprovada" && l.valida_ate >= agoraISO && l.desconto_pct >= descontoPct,
  );
  return coberto ? { ok: true } : { ok: false, motivo: "precisa_liberacao" };
}

/** Supervisor só define até o teto; diretoria define qualquer valor de 0 a 100. */
export function podeDefinirLimite(
  papel: "supervisor" | "diretoria",
  pct: number,
  tetoSupervisor: number,
): boolean {
  if (pct < 0 || pct > 100) return false;
  return papel === "diretoria" || pct <= tetoSupervisor;
}

/** Chave única do orçamento gerado: concluir o mesmo carrinho duas vezes devolve o mesmo orçamento. */
export function chaveIdempotencia(carrinhoId: string): string {
  return `rota:carrinho:${carrinhoId}`;
}

/** Próxima tentativa da fila de envio: 1, 2, 4… minutos, até 60. */
export function proximaTentativaMin(tentativas: number): number {
  return Math.min(60, 2 ** Math.max(0, tentativas));
}

export interface OrcamentoParaEnvio {
  id: string;
  chave_idempotencia: string;
  cliente_codigo: string;
  data: string; // aaaa-mm-dd
  vendedor_email: string;
  itens: {
    codigo_produto: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    preco_unit: number;
    desconto_pct: number;
    total: number;
  }[];
}

const celula = (v: string | number) => {
  const t = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV (separador ";" e vírgula decimal, como o Excel em português) com uma linha por item, para lançamento manual no Shop9. */
export function csvParaLancamento(orcamentos: readonly OrcamentoParaEnvio[]): string {
  const cab = [
    "chave_rota",
    "data",
    "cliente_codigo",
    "vendedor_email",
    "produto_codigo",
    "descricao",
    "unidade",
    "quantidade",
    "preco_unitario",
    "desconto_pct",
    "total_item",
  ];
  const linhas = orcamentos.flatMap((o) =>
    o.itens.map((i) =>
      [
        o.chave_idempotencia,
        o.data.split("-").reverse().join("/"),
        o.cliente_codigo,
        o.vendedor_email,
        i.codigo_produto,
        i.descricao,
        i.unidade,
        i.quantidade,
        i.preco_unit,
        i.desconto_pct,
        i.total,
      ]
        .map(celula)
        .join(";"),
    ),
  );
  return "\uFEFF" + [cab.join(";"), ...linhas].join("\r\n");
}
