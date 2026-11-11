import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EventoCalendario } from "@/regras";

/** Feriados/dias sem expediente e retornos combinados de orçamentos abertos, entre duas datas. */
export function useExtrasCalendario(
  vendedorId: string | undefined,
  empresas: string[],
  inicio: string,
  fim: string,
) {
  return useQuery({
    queryKey: ["agenda-extras", vendedorId, empresas.join(","), inicio, fim],
    enabled: !!vendedorId && empresas.length > 0,
    queryFn: async (): Promise<EventoCalendario[]> => {
      const [fer, orc] = await Promise.all([
        supabase
          .from("feriados")
          .select("id,data,nome,empresa_id")
          .gte("data", inicio)
          .lte("data", fim),
        supabase
          .from("orcamentos")
          .select("id,cliente_id,valor,proximo_followup,clientes(nome)")
          .eq("vendedor_id", vendedorId!)
          .eq("status", "aberto")
          .in("empresa_id", empresas)
          .gte("proximo_followup", inicio)
          .lte("proximo_followup", fim),
      ]);
      if (fer.error) throw fer.error;
      if (orc.error) throw orc.error;
      return [
        ...(fer.data ?? [])
          .filter((f) => f.empresa_id === null || empresas.includes(f.empresa_id))
          .map((f): EventoCalendario => ({
            id: `f-${f.id}`,
            dia: f.data.slice(0, 10),
            tipo: "feriado",
            titulo: f.nome,
            detalhe: "Feriado ou dia sem expediente",
          })),
        ...(orc.data ?? []).map((o): EventoCalendario => {
          const nome = (o as unknown as { clientes: { nome: string } | null }).clientes?.nome;
          return {
            id: `o-${o.id}`,
            dia: o.proximo_followup!.slice(0, 10),
            tipo: "orcamento",
            titulo: `Retorno do orçamento${nome ? `: ${nome}` : ""}`,
            detalhe: "Prazo combinado para voltar ao cliente",
            clienteId: o.cliente_id,
          };
        }),
      ];
    },
  });
}
