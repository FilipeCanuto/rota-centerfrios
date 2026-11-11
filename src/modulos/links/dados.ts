import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TIPOS_ARQUIVO = ["pdf", "jpg", "jpeg", "png", "webp"];
export const LIMITE_ARQUIVO = 20 * 1024 * 1024;
const SETE_DIAS = 7 * 24 * 60 * 60;

export interface Link {
  id: string;
  empresa_id: string | null;
  titulo: string;
  descricao: string | null;
  url: string | null;
  arquivo_path: string | null;
  mensagem_whatsapp: string | null;
  publico: string;
  ordem: number;
  ativo: boolean;
}

export interface LinkForm {
  id?: string | undefined;
  empresa_id: string | null;
  titulo: string;
  descricao: string | null;
  url: string | null;
  mensagem_whatsapp: string | null;
  publico: "interno" | "cliente";
  ordem: number;
  ativo: boolean;
  /** Arquivo novo a enviar; sem ele, mantém o que já existe. */
  arquivo?: File | undefined;
  arquivo_path: string | null;
}

/** A RLS já esconde os inativos de quem não é administrador. */
export function useLinks() {
  return useQuery({
    queryKey: ["links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("links")
        .select(
          "id,empresa_id,titulo,descricao,url,arquivo_path,mensagem_whatsapp,publico,ordem,ativo",
        )
        .order("ordem")
        .order("titulo");
      if (error) throw error;
      return (data ?? []) as Link[];
    },
  });
}

/** Link temporário (7 dias) do arquivo, para enviar ao cliente. */
export async function linkAssinado(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("arquivos").createSignedUrl(path, SETE_DIAS);
  if (error || !data) throw error ?? new Error("Sem link");
  return data.signedUrl;
}

export function extensao(nome: string) {
  return nome.split(".").pop()?.toLowerCase() ?? "";
}

export function useSalvarLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: LinkForm) => {
      let arquivo_path = f.arquivo_path;
      if (f.arquivo) {
        arquivo_path = `${crypto.randomUUID()}.${extensao(f.arquivo.name)}`;
        const up = await supabase.storage.from("arquivos").upload(arquivo_path, f.arquivo);
        if (up.error) throw up.error;
      }
      const campos = {
        empresa_id: f.empresa_id,
        titulo: f.titulo,
        descricao: f.descricao,
        url: f.url,
        arquivo_path,
        mensagem_whatsapp: f.mensagem_whatsapp,
        publico: f.publico,
        ordem: f.ordem,
        ativo: f.ativo,
      };
      const r = f.id
        ? await supabase.from("links").update(campos).eq("id", f.id)
        : await supabase.from("links").insert(campos);
      if (r.error) {
        // Não deixa arquivo órfão no armazenamento se o registro não foi gravado.
        if (f.arquivo && arquivo_path)
          await supabase.storage.from("arquivos").remove([arquivo_path]);
        throw r.error;
      }
      // Trocou o arquivo: apaga o antigo (melhor esforço; sobra só lixo se falhar).
      if (f.arquivo && f.arquivo_path)
        await supabase.storage.from("arquivos").remove([f.arquivo_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["links"] }),
  });
}

export function useApagarLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: Link) => {
      const { error } = await supabase.from("links").delete().eq("id", l.id);
      if (error) throw error;
      if (l.arquivo_path) await supabase.storage.from("arquivos").remove([l.arquivo_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["links"] }),
  });
}
