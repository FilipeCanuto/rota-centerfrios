import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { integracoes, type TipoImportacaoShop9 } from "@/integracoes";
import type { LinhaImportacao } from "@/regras";

/** Texto do arquivo: UTF-8 ou, se falhar, Windows-1252 (o padrão do Excel em português). */
export async function lerArquivo(arquivo: File): Promise<string> {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function useImportar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      tipo: TipoImportacaoShop9;
      empresaId: string;
      arquivo: string;
      linhas: LinhaImportacao[];
    }) => integracoes.shop9.importar(v.tipo, v.empresaId, v.arquivo, v.linhas),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/** Últimos lotes importados (só a diretoria lê). */
export function useHistoricoImportacoes() {
  return useQuery({
    queryKey: ["importacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("importacoes")
        .select("id,tipo,arquivo,total_linhas,inseridas,atualizadas,ignoradas,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Relatório de erros em CSV (abre no Excel). */
export function baixarErros(
  nome: string,
  erros: { linha: number; campo: string; mensagem: string }[],
) {
  const csv = [
    "linha;campo;mensagem",
    ...erros.map((e) => `${e.linha};${e.campo};"${e.mensagem.replace(/"/g, '""')}"`),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `erros-${nome.replace(/\.[^.]+$/, "")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
