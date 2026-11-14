import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// shortcut: `admin_criar_setor` e `admin_atualizar_setor` vêm da mensagem 19 do Lovable e ainda não
// estão nos tipos gerados; depois de regenerar, trocar `bd` por `supabase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bd = supabase as any;

export interface SalvarSetor {
  chave: string;
  nome: string;
  icone: string;
  /** Só na edição; setor novo nasce ativo. */
  ativo?: boolean;
  novo?: boolean;
}

/** Criar, renomear e ativar/desativar. A tabela não aceita escrita direta; o banco audita cada chamada. */
export function useSalvarSetor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: SalvarSetor) => {
      const { error } = f.novo
        ? await bd.rpc("admin_criar_setor", {
            _chave: f.chave,
            _nome: f.nome.trim(),
            _icone: f.icone,
          })
        : await bd.rpc("admin_atualizar_setor", {
            _chave: f.chave,
            _dados: { nome: f.nome.trim(), icone: f.icone, ativo: f.ativo },
          });
      if (error) throw error;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["setores-catalogo"] }),
  });
}
