import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcularPainel, configuracaoPorEmpresa, dataLocal, feriadosDaEmpresa, paraData, type PainelBanco } from "@/regras";

export function chavePainel(usuarioId: string | undefined, empresas: string[]) {
  return ["painel", usuarioId, empresas.join(",")];
}

/** Lê os agregados do banco (sem limite de linhas) e aplica as regras testadas de src/regras. */
export function usePainel(usuarioId: string | undefined, empresas: string[]) {
  return useQuery({
    queryKey: chavePainel(usuarioId, empresas),
    enabled: !!usuarioId && empresas.length > 0,
    queryFn: async () => {
      const hojeISO = dataLocal(new Date());
      const hoje = paraData(hojeISO);
      const desde = `${hoje.getFullYear() - 1}-01-01`;

      const [cfg, fer, ...paineis] = await Promise.all([
        supabase.from("configuracoes_regras").select("empresa_id,chave,valor").in("empresa_id", empresas),
        supabase.from("feriados").select("data,empresa_id").gte("data", desde),
        ...empresas.map((e) => supabase.rpc("painel_vendedor", { _empresa_id: e, _vendedor_id: usuarioId!, _hoje: hojeISO })),
      ]);
      for (const r of [cfg, fer, ...paineis]) if (r.error) throw r.error;

      const regras = configuracaoPorEmpresa(cfg.data ?? [], empresas);
      const linhasFeriados = fer.data ?? [];
      return calcularPainel({
        hoje,
        feriadosGerais: new Set(linhasFeriados.filter((l) => l.empresa_id === null || empresas.includes(l.empresa_id)).map((l) => l.data)),
        empresas: empresas.map((e, i) => ({
          cfg: regras.get(e)!,
          feriados: feriadosDaEmpresa(linhasFeriados, e),
          // O formato é o contrato de painel_vendedor (migração 0008).
          dados: paineis[i]!.data as unknown as PainelBanco,
        })),
      });
    },
  });
}
