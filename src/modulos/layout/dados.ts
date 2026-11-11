import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Busca clientes das empresas selecionadas, no servidor (a RLS limita à carteira visível). */
export function useBuscaClientes(texto: string, empresas: string[], ativo: boolean) {
  const termo = texto.trim();
  return useQuery({
    queryKey: ["busca-clientes", empresas.join(","), termo],
    enabled: ativo && empresas.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("id,nome,cidade,segmento")
        .in("empresa_id", empresas)
        .order("nome")
        .limit(20);
      // Busca por nome ou cidade. Tira os caracteres que quebram o filtro "or" e escapa os curingas do ILIKE.
      const limpo = termo.replace(/[,()]/g, " ").replace(/[%_\\]/g, "\\$&");
      if (termo.length >= 2) q = q.or(`nome.ilike.%${limpo}%,cidade.ilike.%${limpo}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
