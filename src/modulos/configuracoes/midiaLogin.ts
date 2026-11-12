import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validarArquivoMidia, type TipoMidia } from "@/regras";

// Ver nota em modulos/avisos/dados.ts sobre o `bd` sem tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bd = supabase as any;
const BUCKET = "midia-login";

export interface MidiaLogin {
  id: string;
  arquivo_path: string;
  tipo: TipoMidia;
  texto_alternativo: string;
  ordem: number;
  ativo: boolean;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Leitura pública (a tela de login é aberta): a RLS devolve só as ativas a quem não é administrador. */
export function useMidiaLogin(habilitada = true) {
  return useQuery({
    queryKey: ["midia-login"],
    enabled: habilitada,
    queryFn: async () => {
      const { data, error } = await bd.from("midia_login").select("*").order("ordem");
      if (error) throw error;
      // Bucket privado: link assinado curto (a política libera só arquivos ativos).
      return Promise.all(
        ((data ?? []) as MidiaLogin[]).map(async (m) => ({
          ...m,
          url: (await supabase.storage.from(BUCKET).createSignedUrl(m.arquivo_path, 3600)).data
            ?.signedUrl,
        })),
      );
    },
  });
}

export interface MidiaLoginForm {
  id?: string | undefined;
  texto_alternativo: string;
  ordem: number;
  ativo: boolean;
  arquivo?: File | undefined;
  arquivo_path?: string | undefined;
  tipo?: TipoMidia | undefined;
}

export function useSalvarMidiaLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: MidiaLoginForm) => {
      let { arquivo_path, tipo } = f;
      if (f.arquivo) {
        const v = validarArquivoMidia(f.arquivo);
        if (!v.ok) throw new Error(v.motivo);
        tipo = v.tipo;
        arquivo_path = `${crypto.randomUUID()}.${f.arquivo.name.split(".").pop()?.toLowerCase() ?? "bin"}`;
        const up = await supabase.storage.from(BUCKET).upload(arquivo_path, f.arquivo);
        if (up.error) throw up.error;
      }
      if (!arquivo_path || !tipo) throw new Error("Escolha o arquivo.");
      const campos = {
        arquivo_path,
        tipo,
        texto_alternativo: f.texto_alternativo,
        ordem: f.ordem,
        ativo: f.ativo,
      };
      const r = f.id
        ? await bd.from("midia_login").update(campos).eq("id", f.id)
        : await bd.from("midia_login").insert(campos);
      if (r.error) {
        if (f.arquivo) await supabase.storage.from(BUCKET).remove([arquivo_path]);
        throw r.error;
      }
      if (f.arquivo && f.id && f.arquivo_path)
        await supabase.storage.from(BUCKET).remove([f.arquivo_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["midia-login"] }),
  });
}

export function useApagarMidiaLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: MidiaLogin) => {
      const { error } = await bd.from("midia_login").delete().eq("id", m.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([m.arquivo_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["midia-login"] }),
  });
}

/** Grava a nova ordem: o item da posição i recebe `ordem = i`. */
export function useReordenarMidiaLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const rs = await Promise.all(
        ids.map((id, i) => bd.from("midia_login").update({ ordem: i }).eq("id", id)),
      );
      const falha = rs.find((r: { error: unknown }) => r.error);
      if (falha) throw falha.error;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["midia-login"] }),
  });
}
