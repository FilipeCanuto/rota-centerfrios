import { emailDaEmpresa } from "./autenticacao";

/** Decisão pura do que fazer depois do login, conforme os setores liberados (e disponíveis). */
export type DestinoSetor =
  | { tipo: "sem_acesso" }
  | { tipo: "direto"; setor: string }
  | { tipo: "escolher"; setores: string[] };

export function destinoAposLogin(
  liberados: readonly string[],
  disponiveis: readonly string[],
  lembrado: string | null = null,
): DestinoSetor {
  const setores = disponiveis.filter((s) => liberados.includes(s));
  if (setores.length === 0) return { tipo: "sem_acesso" };
  if (setores.length === 1) return { tipo: "direto", setor: setores[0]! };
  if (lembrado && setores.includes(lembrado)) return { tipo: "direto", setor: lembrado };
  return { tipo: "escolher", setores };
}

/** Setor dono de um caminho, pelo prefixo mais longo; `null` = tela comum (só exige login). */
export function setorDaRota(
  caminho: string,
  rotas: Readonly<Record<string, readonly string[]>>,
): string | null {
  let melhor: { setor: string; tamanho: number } | null = null;
  for (const [setor, prefixos] of Object.entries(rotas))
    for (const p of prefixos)
      if ((caminho === p || caminho.startsWith(p + "/")) && p.length > (melhor?.tamanho ?? -1))
        melhor = { setor, tamanho: p.length };
  return melhor?.setor ?? null;
}

export interface FormAcessos {
  nome: string;
  email: string;
  papeis: string[];
  empresas: string[];
  setores: string[];
}

/** Confere o cadastro de acessos (o banco repete as mesmas checagens). Devolve o primeiro erro. */
export function validarAcessos(
  f: FormAcessos,
): { campo: keyof FormAcessos; mensagem: string } | null {
  if (!f.nome.trim()) return { campo: "nome", mensagem: "Informe o nome." };
  if (!emailDaEmpresa(f.email))
    return {
      campo: "email",
      mensagem: "Use o e-mail da empresa (@centerfrios.com ou @grupo381.com.br).",
    };
  if (f.papeis.length === 0) return { campo: "papeis", mensagem: "Marque pelo menos um papel." };
  if (f.empresas.length === 0)
    return { campo: "empresas", mensagem: "Marque pelo menos uma empresa." };
  if (f.setores.length === 0) return { campo: "setores", mensagem: "Marque pelo menos um setor." };
  return null;
}

/** Linha da tabela `setores` (catálogo editável pelo administrador). */
export interface LinhaSetor {
  chave: string;
  nome: string;
  icone: string | null;
  ativo: boolean;
  /** Definido só por migração/deploy: a tela nunca altera. */
  disponivel: boolean;
}

/** Chaves que aparecem no login, no seletor e no cadastro: ativo, disponível e com módulo no código. */
export function chavesDisponiveis(
  linhas: readonly LinhaSetor[],
  comModulo: readonly string[],
): string[] {
  return linhas
    .filter((l) => l.ativo && l.disponivel && comModulo.includes(l.chave))
    .map((l) => l.chave);
}

const CHAVE_SETOR = /^[a-z][a-z_]{1,30}$/;

/** Chave a partir do nome: "Logística Sul" → "logistica_sul" (o banco repete a regra). */
export function chaveDoSetor(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 31);
}

/** Confere nome e chave de um setor (devolve a mensagem do primeiro erro). */
export function validarSetor(nome: string, chave: string): string | null {
  if (nome.trim().length < 2 || nome.trim().length > 60) return "Informe o nome (2 a 60 letras).";
  if (!CHAVE_SETOR.test(chave)) return "Use letras no nome: a chave só aceita a–z e “_”.";
  return null;
}
