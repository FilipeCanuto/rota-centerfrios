import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendaCompartilhada {
  id: string;
  codigo_shop9: string | null;
  data: string;
  tipo: "venda" | "devolucao";
  valor: number;
  /** 50% do valor (negativa na devolução); calculada no banco por `parte_venda`. */
  minha_parte: number;
  papel: 1 | 2;
  cliente: string;
  outro_vendedor: string | null;
  itens: { produto: string; quantidade: number; valor_total: number }[];
}

// shortcut: `minhas_vendas_compartilhadas` vem do texto 22 do Lovable e ainda não está nos tipos gerados; tirar o cast depois.
const rpc = supabase.rpc as unknown as (
  f: "minhas_vendas_compartilhadas",
  a: { _empresa_id: string },
) => PromiseLike<{ data: VendaCompartilhada[] | null; error: { code?: string } | null }>;

/** Vendas com vendedor 2 em que a pessoa participa (como vendedor 1 ou 2), dos últimos 12 meses. */
export function useVendasCompartilhadas(empresas: string[]) {
  return useQuery({
    queryKey: ["vendas-compartilhadas", empresas.join(",")],
    enabled: empresas.length > 0,
    queryFn: async () => {
      const r = await Promise.all(
        empresas.map((e) => rpc.call(supabase, "minhas_vendas_compartilhadas", { _empresa_id: e })),
      );
      const lista: VendaCompartilhada[] = [];
      for (const x of r) {
        if (x.error) throw x.error;
        lista.push(...(x.data ?? []));
      }
      return lista.sort((a, b) => b.data.localeCompare(a.data));
    },
  });
}
