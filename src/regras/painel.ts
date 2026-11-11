import {
  clienteEsquecido,
  clienteSemCompra,
  cobertura,
  orcamentoParado,
  statusRecompra,
  ultimaInteracaoQualificada,
  type StatusRecompra,
} from "./carteira";
import type { ConfiguracaoRegras } from "./configuracoes";
import {
  diasUteisDoMes,
  diasUteisRestantes,
  formatarISO,
  inicioDoMes,
  type Feriados,
} from "./datas";
import { atingimento, metaDiariaCobertura, metaDoDia, projecao } from "./metas";

/** Formato devolvido por painel_vendedor no banco (uma empresa). */
export interface MetaBase {
  meta_vendas: number;
  meta_orcamentos: number;
  meta_cobertura: number;
  meta_reativacao: number;
}
export interface OrcamentoAberto {
  id: string;
  valor: number;
  data: string;
  ultimo_followup: string | null;
}
export interface ClienteBanco {
  id: string;
  nome: string;
  telefone: string | null;
  segmento: string | null;
  cidade: string | null;
  empresa_id: string;
  data_ultima_compra: string | null;
  compras: string[];
  comprou_no_mes: boolean;
  ultima_interacao: string | null;
  ultima_interacao_qualificada: string | null;
  qualificada_hoje: boolean;
  qualificada_no_mes: boolean;
  orcamentos_abertos: OrcamentoAberto[];
}
export interface PainelBanco {
  faturado_mes: number;
  faturado_hoje: number;
  meta: MetaBase | null;
  orcamentos_mes: number;
  orcamentos_hoje: number;
  pontos_hoje: number;
  clientes: ClienteBanco[];
}
export interface EmpresaPainel {
  cfg: ConfiguracaoRegras;
  feriados: Feriados;
  dados: PainelBanco;
}

export type MotivoTipo =
  "recompra_urgente" | "orcamento_parado" | "esquecido" | "recompra_atencao" | "sem_compra";
export interface ItemPlano {
  cliente: ClienteBanco;
  motivo: string;
  tipo: MotivoTipo;
  prioridade: number;
}
export interface Alerta {
  id: string;
  tipo: MotivoTipo;
  titulo: string;
  detalhe: string;
}

/** Ordem do plano do dia: quem perde venda primeiro. */
export const PESO: Record<MotivoTipo, number> = {
  recompra_urgente: 100,
  orcamento_parado: 90,
  esquecido: 70,
  recompra_atencao: 60,
  sem_compra: 50,
};

/** Reativado: comprou no mês depois de ficar N dias ou mais sem comprar (contados até o início do mês). */
export function reativado(
  c: Pick<ClienteBanco, "compras" | "comprou_no_mes">,
  hoje: Date,
  cfg: ConfiguracaoRegras,
): boolean {
  if (!c.comprou_no_mes) return false;
  const inicio = formatarISO(inicioDoMes(hoje));
  const anterior = c.compras
    .filter((d) => d < inicio)
    .sort()
    .at(-1);
  return !!anterior && clienteSemCompra(anterior, inicioDoMes(hoje), cfg);
}

/** Classifica um cliente: motivo do plano do dia (ou nenhum) e alertas. */
export function avaliarCliente(
  c: ClienteBanco,
  hoje: Date,
  cfg: ConfiguracaoRegras,
  feriados: Feriados,
) {
  const r = statusRecompra(c.compras, hoje, cfg);
  const ultimaCompra = c.compras.length ? [...c.compras].sort().at(-1)! : c.data_ultima_compra;
  const semCompra = clienteSemCompra(ultimaCompra, hoje, cfg);
  const esquecido = clienteEsquecido(
    ultimaInteracaoQualificada(c.ultima_interacao_qualificada, ultimaCompra),
    hoje,
    cfg,
  );
  const parados = c.orcamentos_abertos.filter((o) => {
    const ultima = [o.ultimo_followup ?? o.data, c.ultima_interacao ?? ""].sort().at(-1)!;
    return orcamentoParado(ultima, hoje, cfg, feriados);
  });

  let tipo: MotivoTipo | null = null;
  let motivo = "";
  if (semCompra) {
    tipo = "sem_compra";
    motivo = ultimaCompra
      ? `Sem compra há ${cfg.cliente_sem_compra_dias}+ dias — hora de reativar`
      : "Nunca comprou";
  } else if (r.status === "urgente") {
    tipo = "recompra_urgente";
    motivo = `Recompra urgente: compra a cada ${Math.round(r.intervaloMedio!)} dias, última há ${r.diasDesdeUltima}`;
  } else if (parados.length) {
    tipo = "orcamento_parado";
    motivo = "Orçamento parado aguardando retorno";
  } else if (esquecido) {
    tipo = "esquecido";
    motivo = `Sem contato qualificado há ${cfg.cliente_esquecido_dias}+ dias`;
  } else if (r.status === "atencao") {
    tipo = "recompra_atencao";
    motivo = `Recompra próxima: última compra há ${r.diasDesdeUltima} dias`;
  }

  const alertas: Alerta[] = [];
  if (r.status === "urgente" && !semCompra)
    alertas.push({
      id: `r-${c.id}`,
      tipo: "recompra_urgente",
      titulo: `${c.nome}: recompra urgente`,
      detalhe: `Última compra há ${r.diasDesdeUltima} dias (média ${Math.round(r.intervaloMedio!)}).`,
    });
  if (semCompra)
    alertas.push({
      id: `s-${c.id}`,
      tipo: "sem_compra",
      titulo: `${c.nome}: sem compra há ${cfg.cliente_sem_compra_dias}+ dias`,
      detalhe: "Pode ser remanejado pelo supervisor.",
    });
  else if (esquecido)
    alertas.push({
      id: `e-${c.id}`,
      tipo: "esquecido",
      titulo: `${c.nome}: cliente esquecido`,
      detalhe: `Sem interação qualificada há ${cfg.cliente_esquecido_dias} dias ou mais.`,
    });
  for (const o of parados)
    alertas.push({
      id: `o-${o.id}`,
      tipo: "orcamento_parado",
      titulo: `Orçamento parado: ${c.nome}`,
      detalhe: `${cfg.orcamento_parado_dias_uteis}+ dias úteis sem interação.`,
    });

  const item: ItemPlano | null =
    tipo && !c.qualificada_hoje
      ? { cliente: c, motivo, tipo, prioridade: PESO[tipo] + (parados.length ? 5 : 0) }
      : null;
  return { item, alertas, recompra: r.status as StatusRecompra, orcamentosParados: parados.length };
}

/**
 * Painel do vendedor somando as empresas selecionadas. Cada cliente é avaliado com as regras
 * e os feriados da própria empresa; os totais do mês usam `feriadosGerais`.
 * shortcut: na visão "ambas", feriadosGerais é a união das empresas; trocar por cálculo por empresa se as datas divergirem muito.
 */
export function calcularPainel(input: {
  hoje: Date;
  empresas: EmpresaPainel[];
  feriadosGerais: Feriados;
}) {
  const { hoje, empresas, feriadosGerais } = input;
  const soma = (f: (d: PainelBanco) => number) =>
    empresas.reduce((s, e) => s + Number(f(e.dados) ?? 0), 0);

  const meta: MetaBase = {
    meta_vendas: soma((d) => d.meta?.meta_vendas ?? 0),
    meta_orcamentos: soma((d) => d.meta?.meta_orcamentos ?? 0),
    meta_cobertura: Math.max(0, ...empresas.map((e) => Number(e.dados.meta?.meta_cobertura ?? 0))),
    meta_reativacao: soma((d) => d.meta?.meta_reativacao ?? 0),
  };
  const faturadoMes = soma((d) => d.faturado_mes);
  const faturadoHoje = soma((d) => d.faturado_hoje);
  const clientes = empresas.flatMap((e) => e.dados.clientes);
  const cob = cobertura(clientes);

  const itens: ItemPlano[] = [];
  const alertas: Alerta[] = [];
  const recompra = new Map<string, StatusRecompra>();
  let orcamentosParados = 0;
  let reativados = 0;
  for (const e of empresas)
    for (const c of e.dados.clientes) {
      const a = avaliarCliente(c, hoje, e.cfg, e.feriados);
      if (a.item) itens.push(a.item);
      alertas.push(...a.alertas);
      recompra.set(c.id, a.recompra);
      orcamentosParados += a.orcamentosParados;
      if (reativado(c, hoje, e.cfg)) reativados++;
    }

  const maxPlano = Math.max(0, ...empresas.map((e) => e.cfg.plano_do_dia_max));
  itens.sort((a, b) => b.prioridade - a.prioridade || a.cliente.nome.localeCompare(b.cliente.nome));
  alertas.sort((a, b) => PESO[b.tipo] - PESO[a.tipo]);
  const mDia = metaDoDia(meta.meta_vendas, faturadoMes - faturadoHoje, hoje, feriadosGerais);
  const restantes = Math.max(1, diasUteisRestantes(hoje, feriadosGerais));
  const orcamentosHoje = soma((d) => d.orcamentos_hoje);

  return {
    meta,
    faturadoMes,
    falta: Math.max(0, meta.meta_vendas - faturadoMes),
    atingimento: atingimento(faturadoMes, meta.meta_vendas),
    projecao: projecao(faturadoMes, hoje, feriadosGerais),
    metaDoDia: mDia,
    cobertura: cob,
    naoCobertos: cob.total - cob.cobertos,
    plano: itens.slice(0, maxPlano),
    alertas,
    orcamentosParados,
    recompra,
    metasDoDia: [
      { chave: "vendas", nome: "Vendas", atual: faturadoHoje, alvo: mDia, moeda: true },
      {
        chave: "orcamentos",
        nome: "Orçamentos",
        atual: orcamentosHoje,
        alvo: Math.ceil(
          Math.max(0, meta.meta_orcamentos - soma((d) => d.orcamentos_mes) + orcamentosHoje) /
            restantes,
        ),
        moeda: false,
      },
      {
        chave: "cobertura",
        nome: "Cobertura",
        atual: clientes.filter((c) => c.qualificada_hoje).length,
        alvo: metaDiariaCobertura(
          meta.meta_cobertura,
          cob.cobertos,
          cob.total,
          hoje,
          feriadosGerais,
        ),
        moeda: false,
      },
      {
        chave: "reativacao",
        nome: "Reativação",
        atual: reativados,
        alvo: meta.meta_reativacao,
        moeda: false,
      },
    ],
    pontosHoje: soma((d) => d.pontos_hoje),
    diasUteisMes: diasUteisDoMes(hoje, feriadosGerais),
  };
}

export type Painel = ReturnType<typeof calcularPainel>;
