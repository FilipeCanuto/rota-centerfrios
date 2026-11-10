import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatarISO, inicioDoMes, montarConfiguracao, type Interacao } from "@/regras";
import { calcularPainel } from "./calcular";

export function chavePainel(usuarioId: string | undefined, empresas: string[]) {
  return ["painel", usuarioId, empresas.join(",")];
}

export function usePainel(usuarioId: string | undefined, empresas: string[]) {
  return useQuery({
    queryKey: chavePainel(usuarioId, empresas),
    enabled: !!usuarioId && empresas.length > 0,
    queryFn: async () => {
      const hoje = new Date();
      const hojeISO = formatarISO(hoje);
      const inicioMes = formatarISO(inicioDoMes(hoje));
      const umAno = new Date(hoje); umAno.setFullYear(hoje.getFullYear() - 1);

      const [cli, ven, int, orc, orcMes, met, pts, cfg] = await Promise.all([
        supabase.from("clientes").select("id,nome,telefone,segmento,cidade,empresa_id").eq("vendedor_id", usuarioId!).in("empresa_id", empresas).order("nome"),
        supabase.from("vendas").select("cliente_id,data_faturamento,valor").eq("vendedor_id", usuarioId!).in("empresa_id", empresas).gte("data_faturamento", formatarISO(umAno)).range(0, 9999),
        supabase.from("interacoes").select("cliente_id,tipo,cliente_respondeu,resultado,data").eq("vendedor_id", usuarioId!).in("empresa_id", empresas).gte("data", umAno.toISOString()).range(0, 9999),
        supabase.from("orcamentos").select("id,cliente_id,valor,data,ultimo_followup").eq("vendedor_id", usuarioId!).in("empresa_id", empresas).eq("status", "aberto"),
        supabase.from("orcamentos").select("data").eq("vendedor_id", usuarioId!).in("empresa_id", empresas).gte("data", inicioMes),
        supabase.from("metas").select("meta_vendas,meta_orcamentos,meta_cobertura,meta_reativacao").eq("vendedor_id", usuarioId!).in("empresa_id", empresas).eq("mes", inicioMes),
        supabase.from("pontos").select("pontos").eq("vendedor_id", usuarioId!).in("empresa_id", empresas).eq("data", hojeISO),
        supabase.from("configuracoes_regras").select("chave,valor"),
      ]);
      for (const r of [cli, ven, int, orc, orcMes, met, pts, cfg]) if (r.error) throw r.error;

      return calcularPainel({
        hoje,
        cfg: montarConfiguracao(cfg.data ?? []),
        clientes: cli.data ?? [],
        vendas: (ven.data ?? []).map((v) => ({ ...v, valor: Number(v.valor) })),
        interacoes: (int.data ?? []) as Interacao[],
        orcamentosAbertos: (orc.data ?? []).map((o) => ({ ...o, valor: Number(o.valor) })),
        orcamentosMes: orcMes.data?.length ?? 0,
        orcamentosHoje: (orcMes.data ?? []).filter((o) => o.data === hojeISO).length,
        metas: (met.data ?? []).map((m) => ({ ...m, meta_vendas: Number(m.meta_vendas), meta_cobertura: Number(m.meta_cobertura) })),
        pontosHoje: (pts.data ?? []).reduce((s, p) => s + p.pontos, 0),
      });
    },
  });
}
