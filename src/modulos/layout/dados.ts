import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatarISO, hojeEmMaceio } from "@/regras";

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

/** Cobertura do mês para o selo do cabeçalho: contagem leve no banco, sem montar o painel inteiro. */
export function useCoberturaCabecalho(usuarioId: string | undefined, empresas: string[]) {
  return useQuery({
    // Prefixo "painel": registrar um contato já invalida esta consulta.
    queryKey: ["painel", "cobertura", usuarioId, empresas.join(",")],
    enabled: !!usuarioId && empresas.length > 0,
    queryFn: async () => {
      const hoje = formatarISO(hojeEmMaceio());
      const r = await Promise.all(
        empresas.map((e) =>
          supabase.rpc("cobertura_vendedor", {
            _empresa_id: e,
            _vendedor_id: usuarioId!,
            _hoje: hoje,
          }),
        ),
      );
      let total = 0;
      let cobertos = 0;
      for (const x of r) {
        if (x.error) throw x.error;
        const d = x.data as { total: number; cobertos: number };
        total += Number(d.total);
        cobertos += Number(d.cobertos);
      }
      return total > 0 ? cobertos / total : 0;
    },
  });
}
