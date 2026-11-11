import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Recalcula os pontos de hoje e os selos (idempotente no banco) e devolve o resumo do mês.
 * Só para o próprio vendedor: supervisor e diretoria não têm pontos pessoais.
 */
export function useMeusPontos(
  empresaId: string,
  vendedorId: string | undefined,
  hoje: string,
  inicioMes: string,
  fimMes: string,
) {
  return useQuery({
    queryKey: ["gam-meus", empresaId, vendedorId, hoje],
    enabled: !!vendedorId,
    queryFn: async () => {
      const args = { _empresa_id: empresaId, _vendedor_id: vendedorId!, _dia: hoje };
      const [p, s] = await Promise.all([
        supabase.rpc("calcular_pontos_dia", args),
        supabase.rpc("atualizar_selos", args),
      ]);
      // Vendedor só em outra empresa não tem carteira aqui: o banco recusa (42501) e a seção some.
      for (const r of [p, s]) {
        if (r.error?.code === "42501") return null;
        if (r.error) throw r.error;
      }
      const [pontos, selos] = await Promise.all([
        supabase
          .from("pontos")
          .select("indicador,pontos,data")
          .eq("empresa_id", empresaId)
          .eq("vendedor_id", vendedorId!)
          .gte("data", inicioMes)
          .lte("data", fimMes),
        supabase
          .from("selos")
          .select("id,nome,descricao,conquistado_em")
          .eq("empresa_id", empresaId)
          .eq("vendedor_id", vendedorId!)
          .order("conquistado_em", { ascending: false }),
      ]);
      if (pontos.error) throw pontos.error;
      if (selos.error) throw selos.error;
      const linhas = pontos.data ?? [];
      const porIndicador: Record<string, number> = {};
      for (const l of linhas)
        porIndicador[l.indicador] = (porIndicador[l.indicador] ?? 0) + l.pontos;
      return {
        hoje: (p.data ?? {}) as Record<string, number>,
        porIndicador,
        totalMes: linhas.reduce((t, l) => t + l.pontos, 0),
        selos: selos.data ?? [],
      };
    },
  });
}

export interface LinhaRanking {
  posicao: number;
  vendedor_id: string;
  nome: string;
  pontos: number;
  eh_voce: boolean;
}

/** A função do banco já limita o que cada papel enxerga (pódio + você, equipe ou todos). */
export function useRanking(empresaId: string, inicio: string, fim: string) {
  return useQuery({
    queryKey: ["gam-ranking", empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ranking", {
        _empresa_id: empresaId,
        _inicio: inicio,
        _fim: fim,
      });
      if (error) throw error;
      return data as LinhaRanking[];
    },
  });
}

export interface PostInstagram {
  id: string;
  empresa_id: string;
  vendedor_id: string;
  url: string;
  legenda: string;
  data_post: string;
  status: "pendente" | "aprovado" | "recusado";
  motivo_recusa: string | null;
}

export function usePostsInstagram(empresaId: string) {
  return useQuery({
    queryKey: ["gam-posts", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts_instagram")
        .select("id,empresa_id,vendedor_id,url,legenda,data_post,status,motivo_recusa")
        .eq("empresa_id", empresaId)
        .order("data_post", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PostInstagram[];
    },
  });
}

function useInvalidarGam() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("gam-") });
}

export function useEnviarPost() {
  const invalidar = useInvalidarGam();
  return useMutation({
    mutationFn: async (p: {
      empresa_id: string;
      url: string;
      legenda: string;
      data_post: string;
    }) => {
      const { error } = await supabase.from("posts_instagram").insert({ ...p, status: "pendente" });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useValidarPost() {
  const invalidar = useInvalidarGam();
  return useMutation({
    mutationFn: async (p: { id: string; aprovar: boolean; motivo: string }) => {
      const { error } = await supabase.rpc("validar_post_instagram", {
        _post_id: p.id,
        _aprovar: p.aprovar,
        _motivo: p.motivo,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

/** Pesos e hashtag da campanha da empresa (a diretoria edita). */
export const CHAVES_PESO = [
  { chave: "peso_vendas", rotulo: "Vendas" },
  { chave: "peso_cobertura", rotulo: "Cobertura" },
  { chave: "peso_reativacao", rotulo: "Reativação" },
  { chave: "peso_orcamentos", rotulo: "Orçamentos" },
  { chave: "peso_instagram", rotulo: "Instagram" },
];

export function useAjustes(empresaId: string, ativo: boolean) {
  return useQuery({
    queryKey: ["gam-ajustes", empresaId],
    enabled: ativo,
    queryFn: async () => {
      const [r, t] = await Promise.all([
        supabase
          .from("configuracoes_regras")
          .select("chave,valor")
          .eq("empresa_id", empresaId)
          .in(
            "chave",
            CHAVES_PESO.map((c) => c.chave),
          ),
        supabase
          .from("configuracoes_texto")
          .select("valor")
          .eq("empresa_id", empresaId)
          .eq("chave", "hashtag_campanha")
          .maybeSingle(),
      ]);
      if (r.error) throw r.error;
      if (t.error) throw t.error;
      return {
        pesos: Object.fromEntries((r.data ?? []).map((l) => [l.chave, Number(l.valor)])),
        hashtag: t.data?.valor ?? "",
      };
    },
  });
}

/** A hashtag é lida também pelo vendedor, para avisar antes de enviar o post. */
export function useHashtag(empresaId: string) {
  return useQuery({
    queryKey: ["gam-hashtag", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_texto")
        .select("valor")
        .eq("empresa_id", empresaId)
        .eq("chave", "hashtag_campanha")
        .maybeSingle();
      return data?.valor ?? "";
    },
  });
}

export function useSalvarAjustes(empresaId: string) {
  const invalidar = useInvalidarGam();
  return useMutation({
    mutationFn: async (a: { pesos: Record<string, number>; hashtag: string }) => {
      for (const [chave, valor] of Object.entries(a.pesos)) {
        const { data, error } = await supabase
          .from("configuracoes_regras")
          .update({ valor })
          .eq("empresa_id", empresaId)
          .eq("chave", chave)
          .select("chave");
        if (error || !data?.length) throw error ?? new Error("Peso não encontrado");
      }
      const { error } = await supabase
        .from("configuracoes_texto")
        .update({ valor: a.hashtag.trim() })
        .eq("empresa_id", empresaId)
        .eq("chave", "hashtag_campanha");
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}
