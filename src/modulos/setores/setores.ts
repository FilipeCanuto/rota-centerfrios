import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  Calculator,
  ClipboardCheck,
  FileText,
  Landmark,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { chavesDisponiveis, type LinhaSetor } from "@/regras";

// shortcut: a tabela `setores` vem da mensagem 19 do Lovable e ainda não está nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bd = supabase as any;

/** Ícones que o administrador pode escolher (o banco guarda só o nome). */
export const ICONES: Record<string, { rotulo: string; icone: LucideIcon }> = {
  briefcase: { rotulo: "Pasta", icone: Briefcase },
  users: { rotulo: "Pessoas", icone: Users },
  wallet: { rotulo: "Carteira", icone: Wallet },
  receipt: { rotulo: "Nota", icone: Receipt },
  truck: { rotulo: "Caminhão", icone: Truck },
  "clipboard-check": { rotulo: "Lista", icone: ClipboardCheck },
  landmark: { rotulo: "Prédio", icone: Landmark },
  "shopping-cart": { rotulo: "Carrinho", icone: ShoppingCart },
  "file-text": { rotulo: "Documento", icone: FileText },
  calculator: { rotulo: "Calculadora", icone: Calculator },
  building: { rotulo: "Empresa", icone: Building2 },
};
export const iconeDoSetor = (nome: string | null): LucideIcon =>
  (nome ? ICONES[nome]?.icone : undefined) ?? Building2;

/** O que o código sabe de um setor com módulo construído: para onde ele leva e quais rotas guarda. */
export interface ModuloSetor {
  descricao: string;
  /** Para onde o login leva quem entra neste setor. */
  rotaInicial: string;
  /** Prefixos de rota deste setor; a guarda de `/_authenticated` exige o setor para abri-los. */
  rotas: string[];
}

// Setores em prévia (ex.: "rh") só para testar o seletor localmente; nunca definido em produção.
const previa = (import.meta.env["VITE_SETORES_PREVIA"] ?? "").split(",").filter(Boolean);

/**
 * Setor novo com módulo = uma entrada aqui + suas rotas + `disponivel = true` no banco (deploy).
 * Passo a passo em docs/setores.md.
 */
export const MODULOS: Record<string, ModuloSetor> = {
  comercial: {
    descricao: "Carteira, agenda, orçamentos e metas",
    rotaInicial: "/inicio",
    rotas: [
      "/inicio",
      "/conversas",
      "/clientes",
      "/agenda",
      "/mais",
      "/orcamentos",
      "/gestao",
      "/gamificacao",
      "/links",
      "/notificacoes",
      "/configuracoes/feriados",
      "/configuracoes/importacao",
    ],
  },
  ...Object.fromEntries(
    previa.map((c: string) => [
      c,
      { descricao: "Prévia", rotaInicial: `/${c}`, rotas: [`/${c}`] } satisfies ModuloSetor,
    ]),
  ),
};
export const ROTAS_POR_SETOR = Object.fromEntries(
  Object.entries(MODULOS).map(([c, m]) => [c, m.rotas]),
);

export interface SetorTela {
  chave: string;
  nome: string;
  descricao: string;
  icone: LucideIcon;
  rotaInicial: string;
}

export interface Catalogo {
  /** Todas as linhas da tabela (a aba Setores mostra todas). */
  linhas: LinhaSetor[];
  /** Chaves que aparecem no login, no seletor e no cadastro. */
  chaves: string[];
  porChave: (chave: string) => SetorTela | undefined;
}

export function montarCatalogo(linhas: LinhaSetor[]): Catalogo {
  const chaves = chavesDisponiveis(linhas, Object.keys(MODULOS));
  const porChave = (chave: string) => {
    const l = linhas.find((x) => x.chave === chave);
    const m = MODULOS[chave];
    return l && m
      ? {
          chave,
          nome: l.nome,
          descricao: m.descricao,
          icone: iconeDoSetor(l.icone),
          rotaInicial: m.rotaInicial,
        }
      : undefined;
  };
  return { linhas, chaves, porChave };
}

async function carregarCatalogo(): Promise<Catalogo> {
  const { data, error } = await bd
    .from("setores")
    .select("chave,nome,icone,ativo,disponivel")
    .order("nome");
  // shortcut: antes da migração 19 a tabela não existe e só o Comercial aparece; apagar depois.
  if (error && ["PGRST205", "42P01"].includes(error.code))
    return montarCatalogo([
      { chave: "comercial", nome: "Comercial", icone: "briefcase", ativo: true, disponivel: true },
    ]);
  if (error) throw error;
  return montarCatalogo((data ?? []) as LinhaSetor[]);
}

export const consultaCatalogo = {
  queryKey: ["setores-catalogo"],
  queryFn: carregarCatalogo,
  staleTime: 60_000,
};
export const useCatalogo = () => useQuery(consultaCatalogo);

const CHAVE_LEMBRADO = "rota-setor";
export function setorLembrado(): string | null {
  try {
    return localStorage.getItem(CHAVE_LEMBRADO);
  } catch {
    return null;
  }
}
export function lembrarSetor(chave: string | null) {
  try {
    if (chave) localStorage.setItem(CHAVE_LEMBRADO, chave);
    else localStorage.removeItem(CHAVE_LEMBRADO);
  } catch {
    // Sem armazenamento (aba anônima): só não lembra.
  }
}
