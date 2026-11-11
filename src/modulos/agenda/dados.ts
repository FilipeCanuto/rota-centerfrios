import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type TipoTarefa = "retorno" | "visita" | "ligacao" | "tarefa";
export const TIPOS_TAREFA: { valor: TipoTarefa; rotulo: string }[] = [
  { valor: "retorno", rotulo: "Retorno" },
  { valor: "visita", rotulo: "Visita" },
  { valor: "ligacao", rotulo: "Ligação" },
  { valor: "tarefa", rotulo: "Tarefa" },
];

export interface Tarefa {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  titulo: string;
  data: string;
  hora: string | null;
  tipo: TipoTarefa;
  observacao: string | null;
  concluida: boolean;
  motivo_alerta: string | null;
  clientes: { nome: string } | null;
}

/** Tarefas do vendedor entre duas datas, mais as atrasadas ainda abertas (quando `comAtrasadas`). */
export function useTarefas(
  vendedorId: string | undefined,
  inicio: string,
  fim: string,
  comAtrasadas = false,
) {
  return useQuery({
    queryKey: ["tarefas", vendedorId, inicio, fim, comAtrasadas],
    enabled: !!vendedorId,
    queryFn: async () => {
      let q = supabase
        .from("tarefas_agenda")
        .select(
          "id,empresa_id,cliente_id,titulo,data,hora,tipo,observacao,concluida,motivo_alerta,clientes(nome)",
        )
        .eq("vendedor_id", vendedorId!)
        .lte("data", fim)
        .order("data")
        .order("hora", { nullsFirst: true });
      q = comAtrasadas ? q.or(`data.gte.${inicio},concluida.eq.false`) : q.gte("data", inicio);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Tarefa[];
    },
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["tarefas"] });
}

export interface NovaTarefa {
  id?: string;
  empresa_id: string;
  vendedor_id: string;
  cliente_id: string | null;
  titulo: string;
  data: string;
  hora: string | null;
  tipo: TipoTarefa;
  observacao: string | null;
}

export function useSalvarTarefa() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (t: NovaTarefa) => {
      // Só colunas reais; na edição, só as que o vendedor pode alterar (permissão por coluna).
      const { id, empresa_id, vendedor_id, cliente_id, titulo, data, hora, tipo, observacao } = t;
      const campos = { titulo, data, hora, tipo, observacao };
      const { error } = id
        ? await supabase.from("tarefas_agenda").update(campos).eq("id", id)
        : await supabase
            .from("tarefas_agenda")
            .insert({ ...campos, empresa_id, vendedor_id, cliente_id });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useConcluirTarefa() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("tarefas_agenda")
        .update({ concluida, concluida_em: concluida ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

/**
 * Cria as tarefas de retorno do plano do dia. Pula o cliente que já tem retorno automático aberto
 * (de qualquer dia), para um alerta parado não virar um retorno novo por dia; o banco ignora os de hoje.
 */
export function useGerarTarefasDosAlertas(vendedorId: string | undefined) {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (
      todos: { empresa_id: string; cliente_id: string; motivo_alerta: string; titulo: string }[],
    ) => {
      if (!vendedorId || !todos.length) return 0;
      const abertas = await supabase
        .from("tarefas_agenda")
        .select("cliente_id")
        .eq("vendedor_id", vendedorId)
        .eq("concluida", false)
        .not("motivo_alerta", "is", null)
        .in(
          "cliente_id",
          todos.map((i) => i.cliente_id),
        );
      if (abertas.error) throw abertas.error;
      const ja = new Set((abertas.data ?? []).map((a) => a.cliente_id));
      const itens = todos.filter((i) => !ja.has(i.cliente_id));
      if (!itens.length) return 0;
      const { data, error } = await supabase.rpc("gerar_tarefas_dos_alertas", {
        _itens: itens as Json,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      if (n) void invalidar();
    },
  });
}
