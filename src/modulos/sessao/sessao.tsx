import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Perfil = "vendedor" | "supervisor" | "diretoria" | "administrador";

export interface Sessao {
  authId: string;
  usuario: { id: string; nome: string; apelido_copiloto: string; tema: string; perfil: Perfil; demo: boolean } | null;
  papeis: Perfil[];
  empresas: { id: string; nome: string }[];
}

async function carregarSessao(): Promise<Sessao | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const [{ data: usuario }, { data: papeis }, { data: empresas }] = await Promise.all([
    supabase.from("usuarios").select("id,nome,apelido_copiloto,tema,perfil,demo").eq("auth_user_id", u.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    supabase.from("empresas").select("id,nome").order("created_at"),
  ]);
  return {
    authId: u.user.id,
    usuario: (usuario as Sessao["usuario"]) ?? null,
    papeis: (papeis ?? []).map((p) => p.role as Perfil),
    empresas: empresas ?? [],
  };
}

export const consultaSessao = { queryKey: ["sessao"], queryFn: carregarSessao, staleTime: 60_000 };

export function useSessao() {
  return useQuery(consultaSessao);
}

export function podeVerAmbas(papeis: Perfil[]) {
  return papeis.includes("diretoria") || papeis.includes("administrador");
}

// ---- Empresa selecionada ----
type Selecao = string | "ambas";
const CtxEmpresa = createContext<{ empresa: Selecao; definir: (e: Selecao) => void }>({ empresa: "ambas", definir: () => {} });

export function ProvedorEmpresa({ children }: { children: ReactNode }) {
  const { data } = useSessao();
  const [empresa, setEmpresa] = useState<Selecao>("ambas");
  useEffect(() => {
    if (!data) return;
    const salvo = localStorage.getItem("rota-empresa");
    const ids = data.empresas.map((e) => e.id);
    const ambas = podeVerAmbas(data.papeis);
    if (salvo && (ids.includes(salvo) || (salvo === "ambas" && ambas))) setEmpresa(salvo);
    else setEmpresa(ambas ? "ambas" : ids[0] ?? "ambas");
  }, [data]);
  const definir = (e: Selecao) => {
    localStorage.setItem("rota-empresa", e);
    setEmpresa(e);
  };
  return <CtxEmpresa.Provider value={{ empresa, definir }}>{children}</CtxEmpresa.Provider>;
}
export const useEmpresa = () => useContext(CtxEmpresa);

/** IDs das empresas ativas conforme o seletor. */
export function useEmpresasAtivas(): string[] {
  const { data } = useSessao();
  const { empresa } = useEmpresa();
  if (!data) return [];
  return empresa === "ambas" ? data.empresas.map((e) => e.id) : [empresa];
}
