import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dataLocal, montarConfiguracao, type ConfiguracaoRegras } from "@/regras";

export interface FiltrosClientes {
  texto: string;
  segmento: string;
  etiqueta: string;
  semCompra90: boolean;
  vendedorId: string;
}
export const FILTROS_VAZIOS: FiltrosClientes = {
  texto: "",
  segmento: "",
  etiqueta: "",
  semCompra90: false,
  vendedorId: "",
};

export interface ClienteLista {
  id: string;
  nome: string;
  cidade: string | null;
  segmento: string | null;
  etiquetas: string[];
  data_ultima_compra: string | null;
  vendedor_id: string | null;
  empresa_id: string;
}

const POR_PAGINA = 30;

/** Carteira visível (a RLS limita a vendedor, equipe ou tudo), filtrada no servidor. */
export function useListaClientes(
  empresas: string[],
  f: FiltrosClientes,
  pagina: number,
  /** Dias sem compra de cada empresa (o limite é por empresa, como no banco). */
  diasSemCompra: Record<string, number>,
) {
  return useQuery({
    queryKey: ["clientes", empresas.join(","), f, pagina, diasSemCompra],
    enabled: empresas.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("id,nome,cidade,segmento,etiquetas,data_ultima_compra,vendedor_id,empresa_id", {
          count: "exact",
        })
        .in("empresa_id", empresas)
        .order("nome")
        .range(0, (pagina + 1) * POR_PAGINA - 1);
      const termo = f.texto
        .trim()
        .replace(/[,()]/g, " ")
        .replace(/[%_\\]/g, "\\$&");
      if (termo.length >= 2) q = q.or(`nome.ilike.%${termo}%,cidade.ilike.%${termo}%`);
      if (f.segmento) q = q.eq("segmento", f.segmento);
      if (f.etiqueta) q = q.contains("etiquetas", [f.etiqueta]);
      if (f.vendedorId) q = q.eq("vendedor_id", f.vendedorId);
      if (f.semCompra90) {
        const porEmpresa = empresas.map((e) => {
          const limite = dataLocal(new Date(Date.now() - (diasSemCompra[e] ?? 90) * 86_400_000));
          return `and(empresa_id.eq.${e},or(data_ultima_compra.is.null,data_ultima_compra.lte.${limite}))`;
        });
        q = q.or(porEmpresa.join(","));
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        clientes: (data ?? []) as ClienteLista[],
        total: count ?? 0,
        temMais: (count ?? 0) > (pagina + 1) * POR_PAGINA,
      };
    },
  });
}

/** Opções dos filtros: segmentos e etiquetas que existem na carteira visível. */
export function useOpcoesFiltro(empresas: string[]) {
  return useQuery({
    queryKey: ["clientes-opcoes", empresas.join(",")],
    enabled: empresas.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // shortcut: lê até 2.000 clientes para montar as opções; trocar por uma função no banco se a carteira passar disso.
      const { data, error } = await supabase
        .from("clientes")
        .select("segmento,etiquetas")
        .in("empresa_id", empresas)
        .range(0, 1999);
      if (error) throw error;
      const segmentos = new Set<string>();
      const etiquetas = new Set<string>();
      for (const c of data ?? []) {
        if (c.segmento) segmentos.add(c.segmento);
        for (const e of c.etiquetas ?? []) etiquetas.add(e);
      }
      return { segmentos: [...segmentos].sort(), etiquetas: [...etiquetas].sort() };
    },
  });
}

/** Pessoas visíveis (para filtro e remanejamento); a RLS mostra a equipe ao supervisor e todos à diretoria. */
export function usePessoasVisiveis() {
  return useQuery({
    queryKey: ["pessoas-visiveis"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("usuarios").select("id,nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Limites das regras de várias empresas de uma vez, por empresa. */
export function useRegrasPorEmpresa(empresas: string[]) {
  return useQuery({
    queryKey: ["regras-empresas", empresas.join(",")],
    enabled: empresas.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, ConfiguracaoRegras>> => {
      const { data, error } = await supabase
        .from("configuracoes_regras")
        .select("empresa_id,chave,valor")
        .in("empresa_id", empresas);
      if (error) throw error;
      return Object.fromEntries(
        empresas.map((e) => [
          e,
          montarConfiguracao((data ?? []).filter((l) => l.empresa_id === e)),
        ]),
      );
    },
  });
}

/** Limites das regras de uma empresa (configuracoes_regras). */
export function useRegrasDaEmpresa(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["regras", empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ConfiguracaoRegras> => {
      const { data, error } = await supabase
        .from("configuracoes_regras")
        .select("chave,valor")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return montarConfiguracao(data ?? []);
    },
  });
}

export interface Ficha {
  cliente: ClienteLista & {
    telefone: string | null;
    email: string | null;
    documento: string | null;
    codigo_shop9: string | null;
  };
  compras: {
    id: string;
    data: string;
    valor: number;
    codigo_shop9: string | null;
    itens: { produto: string; quantidade: number; valor_total: number }[];
  }[];
  total_12m: number;
  qtd_12m: number;
  ticket_medio_12m: number;
  itens_mais_comprados: { produto: string; quantidade: number; valor_total: number }[];
  orcamentos: {
    id: string;
    status: "aberto" | "ganho" | "perdido";
    data: string;
    valor: number;
    ultimo_followup: string | null;
    proximo_followup: string | null;
    observacao: string | null;
  }[];
  interacoes: {
    id: string;
    tipo: string;
    cliente_respondeu: boolean;
    resultado: string | null;
    data: string;
    dia_local: string;
  }[];
  notas: {
    id: string;
    texto: string;
    autor_id: string;
    autor_nome: string | null;
    created_at: string;
  }[];
}

/** Ficha 360 numa chamada (função ficha_cliente, migração 0013). Nulo = sem acesso ou inexistente. */
export function useFicha(clienteId: string) {
  return useQuery({
    queryKey: ["ficha", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ficha_cliente", { _cliente_id: clienteId });
      if (error) throw error;
      return data as unknown as Ficha | null;
    },
  });
}

function useInvalidarFicha(clienteId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["ficha", clienteId] }),
      qc.invalidateQueries({ queryKey: ["clientes"] }),
      qc.invalidateQueries({ queryKey: ["clientes-opcoes"] }),
    ]);
}

export function useSalvarEtiquetas(clienteId: string) {
  const invalidar = useInvalidarFicha(clienteId);
  return useMutation({
    mutationFn: async (etiquetas: string[]) => {
      const { error } = await supabase.from("clientes").update({ etiquetas }).eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useAdicionarNota(
  cliente: { id: string; empresa_id: string; vendedor_id: string | null },
  autorId: string,
) {
  const invalidar = useInvalidarFicha(cliente.id);
  return useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase.from("notas_cliente").insert({
        cliente_id: cliente.id,
        empresa_id: cliente.empresa_id,
        vendedor_id: cliente.vendedor_id,
        autor_id: autorId,
        texto: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useApagarNota(clienteId: string) {
  const invalidar = useInvalidarFicha(clienteId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("notas_cliente")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length)
        throw new Error("Só quem escreveu pode apagar a nota, nas primeiras 24 horas.");
    },
    onSuccess: invalidar,
  });
}

/** Troca de carteira pela função do banco: valida papel, equipe, 90 dias e grava a auditoria. */
export function useRemanejar(clienteId: string) {
  const invalidar = useInvalidarFicha(clienteId);
  return useMutation({
    mutationFn: async (v: { novoVendedorId: string; motivo: string }) => {
      const { error } = await supabase.rpc("remanejar_cliente", {
        _cliente_id: clienteId,
        _novo_vendedor_id: v.novoVendedorId,
        _motivo: v.motivo.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidar,
  });
}
