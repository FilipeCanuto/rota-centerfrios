import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VersaoPinguim } from "@/regras";

type Campos = Partial<{
  apelido_copiloto: string;
  pinguim_versao: VersaoPinguim;
  copiloto_minimizado: boolean;
}>;

/** O próprio usuário altera só estas três colunas (permissão por coluna no banco). */
export function useAtualizarCopiloto(usuarioId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campos: Campos) => {
      const { error } = await supabase.from("usuarios").update(campos).eq("id", usuarioId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessao"] }),
  });
}
