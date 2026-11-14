import { Briefcase, ShoppingCart, Users, Wallet, type LucideIcon } from "lucide-react";

export interface Setor {
  chave: string;
  nome: string;
  descricao: string;
  icone: LucideIcon;
  /** Para onde o login leva quem entra neste setor. */
  rotaInicial: string;
  /** Prefixos de rota deste setor; a guarda de `/_authenticated` exige o setor para abri-los. */
  rotas: string[];
  /** Falso: some para todos (no login, no seletor e no cadastro). */
  disponivel: boolean;
}

// Setores em prévia (ex.: "rh") só para testar o seletor localmente; nunca definido em produção.
const previa = (import.meta.env["VITE_SETORES_PREVIA"] ?? "").split(",");

/**
 * Registro central dos setores. Setor novo = uma entrada aqui + suas rotas + as políticas do
 * banco das tabelas dele (passo a passo em docs/setores.md).
 */
export const SETORES: Setor[] = [
  {
    chave: "comercial",
    nome: "Comercial",
    descricao: "Carteira, agenda, orçamentos e metas",
    icone: Briefcase,
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
    disponivel: true,
  },
  {
    chave: "rh",
    nome: "RH",
    descricao: "Pessoas, férias e documentos",
    icone: Users,
    rotaInicial: "/rh",
    rotas: ["/rh"],
    disponivel: false,
  },
  {
    chave: "financeiro",
    nome: "Financeiro",
    descricao: "Contas, cobranças e limites",
    icone: Wallet,
    rotaInicial: "/financeiro",
    rotas: ["/financeiro"],
    disponivel: false,
  },
  {
    chave: "compras",
    nome: "Compras",
    descricao: "Pedidos e fornecedores",
    icone: ShoppingCart,
    rotaInicial: "/compras",
    rotas: ["/compras"],
    disponivel: false,
  },
].map((s) => ({ ...s, disponivel: s.disponivel || previa.includes(s.chave) }));

export const SETORES_DISPONIVEIS = SETORES.filter((s) => s.disponivel);
export const CHAVES_DISPONIVEIS = SETORES_DISPONIVEIS.map((s) => s.chave);
export const ROTAS_POR_SETOR = Object.fromEntries(SETORES.map((s) => [s.chave, s.rotas]));
export const setorPorChave = (chave: string) => SETORES.find((s) => s.chave === chave);

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
