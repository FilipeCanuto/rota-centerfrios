import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// shortcut: funções admin_shop9_* e admin_conector_* vêm da mensagem 21 do Lovable e ainda não estão
// nos tipos gerados; depois de regenerar, trocar `bd` por `supabase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bd = supabase as any;

export type ModoShop9 = "manual" | "conector";
export type AmbienteShop9 = "homologacao" | "producao";

export interface ConectorStatus {
  id: string;
  nome: string;
  ativo: boolean;
  ultimo_contato: string | null;
  versao: string | null;
}

export interface EventoConector {
  id: string;
  criado_em: string;
  tipo: string;
  ok: boolean;
  mensagem: string | null;
}

export interface StatusShop9 {
  modo: ModoShop9;
  ambiente: AmbienteShop9;
  conectores: ConectorStatus[];
  eventos: EventoConector[];
}

const CHAVE = ["shop9-integracao"];

async function chamar<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await bd.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

/** Só administrador (o banco recusa os demais). Atualiza a cada 30 s para o status online/offline. */
export const useStatusShop9 = () =>
  useQuery({
    queryKey: CHAVE,
    queryFn: () => chamar<StatusShop9>("admin_shop9_status"),
    refetchInterval: 30_000,
  });

function useAcao<A>(fn: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => chamar<unknown>(fn, args as Record<string, unknown>),
    onSettled: () => void qc.invalidateQueries({ queryKey: CHAVE }),
  });
}

export const useConfigurarShop9 = () =>
  useAcao<{ _modo: ModoShop9; _ambiente: AmbienteShop9 }>("admin_shop9_configurar");

/** Cadastra o conector (sem id) ou troca a chave pública (com id). Devolve o id do conector. */
export const useRegistrarChave = () =>
  useAcao<{ _conector_id: string | null; _nome: string; _chave_publica: string }>(
    "admin_conector_registrar_chave",
  );

export const useRevogarConector = () => useAcao<{ _conector_id: string }>("admin_conector_revogar");
