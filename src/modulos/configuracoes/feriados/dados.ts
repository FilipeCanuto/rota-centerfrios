import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Abrangencia = "nacional" | "estadual" | "municipal" | "empresa";

export interface Feriado {
  id: string;
  data: string;
  nome: string;
  abrangencia: Abrangencia;
  localidade: string | null;
  empresa_id: string | null;
  data_movel: boolean;
}
export type NovoFeriado = Omit<Feriado, "id"> & { id?: string };

export const ABRANGENCIAS: { valor: Abrangencia; rotulo: string; dica: string }[] = [
  { valor: "nacional", rotulo: "Nacional", dica: "Feriado em todo o país" },
  { valor: "estadual", rotulo: "Estadual", dica: "Feriado de Alagoas ou de outro estado" },
  { valor: "municipal", rotulo: "Municipal", dica: "Feriado de uma cidade" },
  {
    valor: "empresa",
    rotulo: "Dia sem expediente",
    dica: "Definido pela diretoria, como Carnaval e Corpus Christi",
  },
];

const chave = (ano: number) => ["feriados", ano];

export function useFeriados(ano: number) {
  return useQuery({
    queryKey: chave(ano),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriados")
        .select("id,data,nome,abrangencia,localidade,empresa_id,data_movel")
        .gte("data", `${ano}-01-01`)
        .lte("data", `${ano}-12-31`)
        .order("data");
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
  });
}

/** Feriados mudam dias úteis: o painel precisa recalcular. */
function useInvalidar() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["feriados"] }),
      qc.invalidateQueries({ queryKey: ["painel"] }),
    ]);
}

export function useSalvarFeriado() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (f: NovoFeriado) => {
      const linha = { ...f, nome: f.nome.trim(), localidade: f.localidade?.trim() || null };
      const { error } = f.id
        ? await supabase.from("feriados").update(linha).eq("id", f.id)
        : await supabase.from("feriados").insert(linha);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

/** Desfazer a exclusão: volta a mesma linha, com o mesmo id. */
export function useRestaurarFeriado() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (f: Feriado) => {
      const { error } = await supabase.from("feriados").insert(f);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useExcluirFeriado() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feriados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useCopiarParaAno() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (anoOrigem: number) => {
      const { data, error } = await supabase.rpc("copiar_feriados_para_ano", {
        _ano_origem: anoOrigem,
        _ano_destino: anoOrigem + 1,
      });
      if (error) throw error;
      return data as { copiados: number; ja_existiam: number; ignorados_moveis: number };
    },
    onSuccess: invalidar,
  });
}

/** Mensagem de erro do banco em linguagem do time (data repetida, sem permissão). */
export function explicarErro(e: unknown): string {
  const code = (e as { code?: string } | null)?.code;
  if (code === "23505") return "Já existe uma data cadastrada nesse dia para essa empresa.";
  if (code === "42501") return "Só a diretoria pode alterar o calendário.";
  return "Não foi possível salvar. Verifique a conexão e tente de novo.";
}
