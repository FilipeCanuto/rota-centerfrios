import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  configuracaoPorEmpresa,
  feriadosDaEmpresa,
  type ConfiguracaoRegras,
  type Feriados,
} from "@/regras";

export type StatusOrcamento = "aberto" | "ganho" | "perdido";

export interface Orcamento {
  id: string;
  empresa_id: string;
  cliente_id: string;
  status: string;
  data: string;
  valor: number;
  ultimo_followup: string | null;
  proximo_followup: string | null;
  observacao: string | null;
  clientes: { nome: string } | null;
}

/** Orçamentos visíveis (a RLS limita à carteira) mais as regras de cada empresa, para marcar os parados. */
export function useOrcamentos(status: StatusOrcamento, empresas: string[]) {
  return useQuery({
    queryKey: ["orcamentos", status, empresas.join(",")],
    enabled: empresas.length > 0,
    queryFn: async () => {
      const [lista, cfg, fer] = await Promise.all([
        supabase
          .from("orcamentos")
          .select(
            "id,empresa_id,cliente_id,status,data,valor,ultimo_followup,proximo_followup,observacao,clientes(nome)",
          )
          .eq("status", status)
          .in("empresa_id", empresas)
          .order("data", { ascending: false })
          .limit(200),
        supabase
          .from("configuracoes_regras")
          .select("empresa_id,chave,valor")
          .in("empresa_id", empresas),
        supabase.from("feriados").select("data,empresa_id"),
      ]);
      for (const r of [lista, cfg, fer]) if (r.error) throw r.error;
      const regras = configuracaoPorEmpresa(cfg.data ?? [], empresas);
      const feriados = fer.data ?? [];
      return {
        orcamentos: (lista.data ?? []) as unknown as Orcamento[],
        regras: (e: string): ConfiguracaoRegras => regras.get(e)!,
        feriados: (e: string): Feriados => feriadosDaEmpresa(feriados, e),
      };
    },
  });
}

/** Registra o retorno de hoje; o vendedor só pode alterar estas três colunas (permissão por coluna). */
export function useRegistrarRetorno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id: string;
      hoje: string;
      proximo_followup: string | null;
      observacao: string | null;
    }) => {
      const { error } = await supabase
        .from("orcamentos")
        .update({
          ultimo_followup: p.hoje,
          proximo_followup: p.proximo_followup,
          observacao: p.observacao,
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orcamentos"] });
      // O Início e a ficha contam orçamentos parados com estes mesmos dados.
      void qc.invalidateQueries({ queryKey: ["painel"] });
      void qc.invalidateQueries({ queryKey: ["ficha"] });
    },
  });
}
