import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Apaga só os dados marcados como demonstração (função do banco, restrita a administrador e diretoria). */
export function useApagarDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("apagar_dados_demo");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}
