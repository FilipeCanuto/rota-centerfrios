import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validarArquivoMidia, type TipoMidia } from "@/regras";

// Tipos escritos à mão até o Lovable aplicar a migração e regenerar `types.ts`;
// depois disso dá para trocar por `Tables<"avisos">` e tirar o `bd`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bd = supabase as any;

export type EmpresaAviso = "CENTERFRIOS" | "381" | "ambas";

export interface Aviso {
  id: string;
  titulo: string;
  texto_alternativo: string;
  arquivo_path: string;
  tipo: TipoMidia;
  link: string | null;
  empresa: EmpresaAviso;
  inicio: string | null;
  fim: string | null;
  ordem: number;
  ativo: boolean;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvisoForm {
  id?: string | undefined;
  titulo: string;
  texto_alternativo: string;
  link: string | null;
  empresa: EmpresaAviso;
  inicio: string | null;
  fim: string | null;
  ordem: number;
  ativo: boolean;
  /** Arquivo novo; obrigatório ao criar, opcional ao editar. */
  arquivo?: File | undefined;
  arquivo_path?: string | undefined;
  tipo?: TipoMidia | undefined;
}

const BUCKET = "avisos";

/** A RLS já limita quem lê; a tela filtra por data e empresa. */
export function useAvisos() {
  return useQuery({
    queryKey: ["avisos"],
    queryFn: async () => {
      const { data, error } = await bd
        .from("avisos")
        .select("*")
        .order("ordem")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Aviso[];
    },
  });
}

/** Link temporário (1 hora) para mostrar o arquivo do bucket privado. */
export async function urlDoAviso(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error("Sem link");
  return data.signedUrl;
}

export function useSalvarAviso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: AvisoForm) => {
      let { arquivo_path, tipo } = f;
      if (f.arquivo) {
        const v = validarArquivoMidia(f.arquivo);
        if (!v.ok) throw new Error(v.motivo);
        tipo = v.tipo;
        arquivo_path = `${crypto.randomUUID()}.${f.arquivo.name.split(".").pop()?.toLowerCase() ?? "bin"}`;
        const up = await supabase.storage.from(BUCKET).upload(arquivo_path, f.arquivo);
        if (up.error) throw up.error;
      }
      if (!arquivo_path || !tipo) throw new Error("Escolha o arquivo do aviso.");
      const campos = {
        titulo: f.titulo,
        texto_alternativo: f.texto_alternativo,
        arquivo_path,
        tipo,
        link: f.link,
        empresa: f.empresa,
        inicio: f.inicio,
        fim: f.fim,
        ordem: f.ordem,
        ativo: f.ativo,
      };
      const r = f.id
        ? await bd.from("avisos").update(campos).eq("id", f.id)
        : await bd.from("avisos").insert(campos);
      if (r.error) {
        if (f.arquivo) await supabase.storage.from(BUCKET).remove([arquivo_path]);
        throw r.error;
      }
      // Trocou o arquivo: apaga o antigo (melhor esforço).
      if (f.arquivo && f.id && f.arquivo_path)
        await supabase.storage.from(BUCKET).remove([f.arquivo_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["avisos"] }),
  });
}

export function useApagarAviso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Aviso) => {
      const { error } = await bd.from("avisos").delete().eq("id", a.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([a.arquivo_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["avisos"] }),
  });
}

/** Administrador ou quem tem "Pode publicar avisos". Só para esconder botões; o banco é quem barra. */
export function usePodePublicarAvisos() {
  return useQuery({
    queryKey: ["pode-publicar-avisos"],
    queryFn: async () => {
      const { data, error } = await bd.rpc("pode_publicar_avisos");
      return !error && data === true; // sem a migração aplicada, fica desligado
    },
    staleTime: 60_000,
  });
}

/** Liga ou desliga a permissão de um usuário (só administrador; usa a função administrativa do banco). */
export function useDefinirPodePublicarAvisos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { usuarioId: string; valor: boolean }) => {
      const { error } = await supabase.rpc("admin_atualizar_usuario", {
        _usuario_id: p.usuarioId,
        _dados: { pode_publicar_avisos: p.valor },
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries(),
  });
}
