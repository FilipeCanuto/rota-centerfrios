import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  configuracaoPorEmpresa,
  feriadosDaEmpresa,
  type ConfiguracaoRegras,
  type Feriados,
  type LinhaGestao,
} from "@/regras";

export interface GestaoEmpresa {
  empresaId: string;
  linhas: LinhaGestao[];
  cfg: ConfiguracaoRegras;
  feriados: Feriados;
}

/** Uma chamada por empresa; a RLS do chamador decide quais vendedores aparecem (equipe ou todos). */
export function useGestao(empresas: string[], hoje: string) {
  return useQuery({
    queryKey: ["gestao", empresas.join(","), hoje],
    enabled: empresas.length > 0,
    queryFn: async (): Promise<GestaoEmpresa[]> => {
      const [cfg, fer, ...paineis] = await Promise.all([
        supabase
          .from("configuracoes_regras")
          .select("empresa_id,chave,valor")
          .in("empresa_id", empresas),
        supabase.from("feriados").select("data,empresa_id"),
        ...empresas.map((e) => supabase.rpc("painel_gestao", { _empresa_id: e, _hoje: hoje })),
      ]);
      for (const r of [cfg, fer, ...paineis]) if (r.error) throw r.error;
      const regras = configuracaoPorEmpresa(cfg.data ?? [], empresas);
      return empresas.map((e, i) => ({
        empresaId: e,
        linhas: (paineis[i]!.data ?? []) as unknown as LinhaGestao[],
        cfg: regras.get(e)!,
        feriados: feriadosDaEmpresa(fer.data ?? [], e),
      }));
    },
  });
}
