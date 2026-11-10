import {
  atingimento, clienteEsquecido, clienteSemCompra, cobertura, diasUteisDoMes, diasUteisRestantes, formatarISO,
  inicioDoMes, interacaoQualificada, metaDoDia, orcamentoParado, projecao, statusRecompra,
  type ConfiguracaoRegras, type Interacao, type StatusRecompra,
} from "@/regras";

export interface ClienteBase { id: string; nome: string; telefone: string | null; segmento: string | null; cidade: string | null; empresa_id: string }
export interface VendaBase { cliente_id: string; data_faturamento: string; valor: number }
export interface OrcamentoBase { id: string; cliente_id: string; valor: number; data: string; ultimo_followup: string | null }
export interface MetaBase { meta_vendas: number; meta_orcamentos: number; meta_cobertura: number; meta_reativacao: number }

export type MotivoTipo = "recompra_urgente" | "orcamento_parado" | "esquecido" | "recompra_atencao" | "sem_compra";

export interface ItemPlano {
  cliente: ClienteBase;
  motivo: string;
  tipo: MotivoTipo;
  prioridade: number;
}

export interface Alerta { id: string; tipo: MotivoTipo; titulo: string; detalhe: string }

const PESO: Record<MotivoTipo, number> = { recompra_urgente: 100, orcamento_parado: 90, esquecido: 70, recompra_atencao: 60, sem_compra: 50 };

export function calcularPainel(input: {
  hoje: Date;
  cfg: ConfiguracaoRegras;
  clientes: ClienteBase[];
  vendas: VendaBase[];
  interacoes: Interacao[];
  orcamentosAbertos: OrcamentoBase[];
  orcamentosMes: number;
  orcamentosHoje: number;
  metas: MetaBase[];
  pontosHoje: number;
}) {
  const { hoje, cfg, clientes, vendas, interacoes } = input;
  const hojeISO = formatarISO(hoje);
  const inicioMesISO = formatarISO(inicioDoMes(hoje));

  const meta = input.metas.reduce(
    (a, m) => ({
      meta_vendas: a.meta_vendas + Number(m.meta_vendas),
      meta_orcamentos: a.meta_orcamentos + m.meta_orcamentos,
      meta_cobertura: Math.max(a.meta_cobertura, Number(m.meta_cobertura)),
      meta_reativacao: a.meta_reativacao + m.meta_reativacao,
    }),
    { meta_vendas: 0, meta_orcamentos: 0, meta_cobertura: 0, meta_reativacao: 0 },
  );

  const vendasMes = vendas.filter((v) => v.data_faturamento >= inicioMesISO && v.data_faturamento <= hojeISO);
  const faturadoMes = vendasMes.reduce((s, v) => s + Number(v.valor), 0);
  const faturadoHoje = vendasMes.filter((v) => v.data_faturamento === hojeISO).reduce((s, v) => s + Number(v.valor), 0);
  const faturadoAteOntem = faturadoMes - faturadoHoje;

  const interacoesMes = interacoes.filter((i) => i.data.slice(0, 10) >= inicioMesISO);
  const cob = cobertura(clientes.map((c) => c.id), interacoesMes, vendasMes);

  // por cliente
  const comprasPorCliente = new Map<string, string[]>();
  for (const v of vendas) (comprasPorCliente.get(v.cliente_id) ?? comprasPorCliente.set(v.cliente_id, []).get(v.cliente_id)!).push(v.data_faturamento);
  const ultimaQualif = new Map<string, string>();
  const ultimaInteracao = new Map<string, string>();
  for (const i of interacoes) {
    const d = i.data.slice(0, 10);
    if ((ultimaInteracao.get(i.cliente_id) ?? "") < d) ultimaInteracao.set(i.cliente_id, d);
    if (interacaoQualificada(i) && (ultimaQualif.get(i.cliente_id) ?? "") < d) ultimaQualif.set(i.cliente_id, d);
  }
  const contatadosHoje = new Set(interacoes.filter((i) => i.data.slice(0, 10) === hojeISO && interacaoQualificada(i)).map((i) => i.cliente_id));

  const itens: ItemPlano[] = [];
  const alertas: Alerta[] = [];
  const recompra = new Map<string, StatusRecompra>();
  let reativados = 0;

  const parados = input.orcamentosAbertos.filter((o) => {
    const ult = [o.ultimo_followup ?? o.data, ultimaInteracao.get(o.cliente_id) ?? ""].sort().at(-1)!;
    return orcamentoParado(ult, hoje, cfg);
  });
  const clientesComOrcParado = new Set(parados.map((o) => o.cliente_id));

  for (const c of clientes) {
    const compras = comprasPorCliente.get(c.id) ?? [];
    const r = statusRecompra(compras, hoje, cfg);
    recompra.set(c.id, r.status);
    const anteriores = compras.filter((d) => d < inicioMesISO).sort();
    if (compras.some((d) => d >= inicioMesISO) && anteriores.length && clienteSemCompra(anteriores.at(-1)!, inicioDoMes(hoje), cfg)) reativados++;

    if (contatadosHoje.has(c.id)) continue;
    const ultimaCompra = compras.length ? [...compras].sort().at(-1)! : null;
    const semCompra = clienteSemCompra(ultimaCompra, hoje, cfg);
    const esquecido = clienteEsquecido(ultimaQualif.get(c.id) ?? null, hoje, cfg);
    let tipo: MotivoTipo | null = null;
    let motivo = "";
    if (semCompra) {
      tipo = "sem_compra";
      motivo = ultimaCompra ? `Sem compra há ${r.diasDesdeUltima ?? "mais de " + cfg.cliente_sem_compra_dias} dias — hora de reativar` : "Nunca comprou";
    } else if (r.status === "urgente") {
      tipo = "recompra_urgente";
      motivo = `Recompra urgente: compra a cada ${Math.round(r.intervaloMedio!)} dias, última há ${r.diasDesdeUltima}`;
    } else if (clientesComOrcParado.has(c.id)) {
      tipo = "orcamento_parado";
      motivo = "Orçamento parado aguardando retorno";
    } else if (esquecido) {
      tipo = "esquecido";
      motivo = `Sem contato qualificado há ${cfg.cliente_esquecido_dias}+ dias`;
    } else if (r.status === "atencao") {
      tipo = "recompra_atencao";
      motivo = `Recompra próxima: última compra há ${r.diasDesdeUltima} dias`;
    }
    if (tipo) itens.push({ cliente: c, motivo, tipo, prioridade: PESO[tipo] + (clientesComOrcParado.has(c.id) ? 5 : 0) });

    if (r.status === "urgente" && !semCompra) alertas.push({ id: `r-${c.id}`, tipo: "recompra_urgente", titulo: `${c.nome}: recompra urgente`, detalhe: `Última compra há ${r.diasDesdeUltima} dias (média ${Math.round(r.intervaloMedio!)}).` });
    if (semCompra) alertas.push({ id: `s-${c.id}`, tipo: "sem_compra", titulo: `${c.nome}: sem compra há ${cfg.cliente_sem_compra_dias}+ dias`, detalhe: "Pode ser remanejado pelo supervisor." });
    else if (esquecido) alertas.push({ id: `e-${c.id}`, tipo: "esquecido", titulo: `${c.nome}: cliente esquecido`, detalhe: `Sem interação qualificada há ${cfg.cliente_esquecido_dias} dias ou mais.` });
  }
  const nomes = new Map(clientes.map((c) => [c.id, c.nome]));
  for (const o of parados) alertas.push({ id: `o-${o.id}`, tipo: "orcamento_parado", titulo: `Orçamento parado: ${nomes.get(o.cliente_id) ?? "cliente"}`, detalhe: `${cfg.orcamento_parado_dias_uteis}+ dias úteis sem interação.` });

  itens.sort((a, b) => b.prioridade - a.prioridade || a.cliente.nome.localeCompare(b.cliente.nome));
  const plano = itens.slice(0, cfg.plano_do_dia_max);
  alertas.sort((a, b) => PESO[b.tipo] - PESO[a.tipo]);

  const mDia = metaDoDia(meta.meta_vendas, faturadoAteOntem, hoje);
  const restantes = Math.max(1, diasUteisRestantes(hoje));
  const naoCobertos = cob.total - cob.cobertos;
  const alvoCobertura = Math.max(0, Math.ceil((meta.meta_cobertura / 100) * cob.total) - cob.cobertos);

  return {
    meta,
    faturadoMes,
    falta: Math.max(0, meta.meta_vendas - faturadoMes),
    atingimento: atingimento(faturadoMes, meta.meta_vendas),
    projecao: projecao(faturadoMes, hoje),
    metaDoDia: mDia,
    cobertura: cob,
    naoCobertos,
    plano,
    alertas,
    orcamentosParados: parados.length,
    recompra,
    metasDoDia: [
      { chave: "vendas", nome: "Vendas", atual: faturadoHoje, alvo: mDia, moeda: true },
      { chave: "orcamentos", nome: "Orçamentos", atual: input.orcamentosHoje, alvo: Math.max(1, Math.ceil(Math.max(0, meta.meta_orcamentos - input.orcamentosMes + input.orcamentosHoje) / restantes)), moeda: false },
      { chave: "cobertura", nome: "Cobertura", atual: contatadosHoje.size, alvo: Math.max(1, Math.ceil(alvoCobertura / restantes)), moeda: false },
      { chave: "reativacao", nome: "Reativação", atual: reativados, alvo: Math.max(1, meta.meta_reativacao), moeda: false },
    ],
    pontosHoje: input.pontosHoje,
    diasUteisMes: diasUteisDoMes(hoje),
  };
}

export type Painel = ReturnType<typeof calcularPainel>;
