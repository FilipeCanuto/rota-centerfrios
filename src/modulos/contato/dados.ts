import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TipoInteracao } from "@/regras";

export interface NovoContato {
  empresa_id: string;
  cliente_id: string;
  vendedor_id: string;
  tipo: TipoInteracao;
  cliente_respondeu: boolean;
  resultado: string | null;
  /** Próximo passo opcional: vira tarefa na agenda. */
  proximo?: { titulo: string; data: string } | undefined;
}

/** Registra a interação e, se houver, a tarefa do próximo passo. Se só a tarefa falhar, avisa sem desfazer o contato. */
export function useRegistrarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proximo, ...contato }: NovoContato) => {
      const r = await supabase.from("interacoes").insert(contato);
      if (r.error) throw new Error("Não foi possível salvar. Tente novamente.");
      if (proximo) {
        const t = await supabase.from("tarefas_agenda").insert({
          empresa_id: contato.empresa_id,
          cliente_id: contato.cliente_id,
          vendedor_id: contato.vendedor_id,
          titulo: proximo.titulo,
          data: proximo.data,
        });
        // Não lança erro: o contato já foi gravado e salvar de novo o duplicaria.
        if (t.error) return { tarefaFalhou: true };
      }
      return { tarefaFalhou: false };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["painel"] }),
  });
}
