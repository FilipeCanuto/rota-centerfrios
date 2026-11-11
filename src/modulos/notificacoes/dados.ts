import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Alerta } from "@/regras";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida_em: string | null;
  created_at: string;
}

/** As 50 mais recentes da própria pessoa (a RLS só devolve as dela). */
export function useNotificacoes(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ["notificacoes", usuarioId],
    enabled: !!usuarioId,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id,tipo,titulo,corpo,link,lida_em,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notificacao[];
    },
  });
}

export function useMarcarLidas(usuarioId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    /** Sem ids, marca todas as não lidas. Só a coluna lida_em pode ser alterada. */
    mutationFn: async (ids?: string[]) => {
      let q = supabase
        .from("notificacoes")
        .update({ lida_em: new Date().toISOString() })
        .is("lida_em", null);
      if (ids) q = q.in("id", ids);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", usuarioId] }),
  });
}

const TIPO_NOTIFICACAO: Record<Alerta["tipo"], string> = {
  recompra_urgente: "recompra",
  recompra_atencao: "recompra",
  sem_compra: "recompra",
  orcamento_parado: "orcamento_parado",
  esquecido: "esquecido",
};
/** Teto por chamada, para um dia muito cheio não virar uma enxurrada de avisos. */
const MAXIMO_POR_DIA = 30;

/** Registra os alertas do dia como notificações; a chave com a data evita repetir no mesmo dia. */
export function useRegistrarAlertas(usuarioId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ alertas, hoje }: { alertas: Alerta[]; hoje: string }) => {
      const itens = alertas.slice(0, MAXIMO_POR_DIA).map((a) => ({
        tipo: TIPO_NOTIFICACAO[a.tipo],
        titulo: a.titulo,
        corpo: a.detalhe,
        link: "/inicio#alertas",
        chave: `${a.id}:${hoje}`,
      }));
      if (!itens.length) return 0;
      const { data, error } = await supabase.rpc("registrar_notificacoes", {
        _itens: itens as Json,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      if (n) void qc.invalidateQueries({ queryKey: ["notificacoes", usuarioId] });
    },
  });
}
