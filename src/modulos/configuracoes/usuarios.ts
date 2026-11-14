import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FormAcessos } from "@/regras";

// shortcut: `usuarios.ativo`, `usuario_setores` e as funções admin_* vêm da mensagem 18 do Lovable e
// ainda não estão nos tipos gerados; depois de regenerar, trocar `bd` por `supabase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bd = supabase as any;

export const PAPEIS = [
  { valor: "vendedor", rotulo: "Vendedor" },
  { valor: "supervisor", rotulo: "Supervisor" },
  { valor: "diretoria", rotulo: "Diretoria" },
  { valor: "administrador", rotulo: "Administrador" },
] as const;

export interface UsuarioAcessos {
  id: string;
  nome: string;
  email: string | null;
  temLogin: boolean;
  ativo: boolean;
  pode_publicar_avisos: boolean;
  /** Só leitura: alterado apenas pela função de servidor `definir_acesso_total`. */
  acesso_total: boolean;
  papeis: string[];
  empresas: string[];
  setores: string[];
}

type Linha = Record<string, unknown>;

async function lista<T = Linha>(consulta: PromiseLike<{ data: T[] | null; error: unknown }>) {
  const { data, error } = await consulta;
  if (error) throw error;
  return data ?? [];
}

/** Monta a lista do administrador; o banco só devolve essas linhas para `eh_admin()`. */
export function useUsuariosAcessos() {
  return useQuery({
    queryKey: ["usuarios-acessos"],
    queryFn: async (): Promise<UsuarioAcessos[]> => {
      const [usuarios, roles, pre, empresas, setores] = await Promise.all([
        lista(
          bd
            .from("usuarios")
            .select("id,nome,email,auth_user_id,ativo,pode_publicar_avisos,acesso_total")
            .eq("demo", false)
            .order("nome"),
        ),
        lista(bd.from("user_roles").select("user_id,role").is("empresa_id", null)),
        lista(bd.from("papeis_pre_cadastro").select("usuario_id,role").is("empresa_id", null)),
        lista(bd.from("usuario_empresas").select("usuario_id,empresa_id")),
        lista(bd.from("usuario_setores").select("usuario_id,setor").eq("ativo", true)),
      ]);
      const de = (linhas: Linha[], chave: string, valor: string, id: unknown) =>
        linhas.filter((l) => l[chave] === id).map((l) => String(l[valor]));
      return usuarios.map((u) => ({
        id: String(u["id"]),
        nome: String(u["nome"]),
        email: (u["email"] as string | null) ?? null,
        temLogin: u["auth_user_id"] != null,
        ativo: u["ativo"] !== false,
        pode_publicar_avisos: u["pode_publicar_avisos"] === true,
        acesso_total: u["acesso_total"] === true,
        papeis:
          u["auth_user_id"] != null
            ? de(roles, "user_id", "role", u["auth_user_id"])
            : de(pre, "usuario_id", "role", u["id"]),
        empresas: de(empresas, "usuario_id", "empresa_id", u["id"]),
        setores: de(setores, "usuario_id", "setor", u["id"]),
      }));
    },
  });
}

export interface SalvarUsuario extends FormAcessos {
  id: string | null;
  ativo: boolean;
  pode_publicar_avisos: boolean;
}

/** Pré-cadastro ou edição; o banco confere papel, setor mínimo e grava a auditoria. */
export function useSalvarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: SalvarUsuario) => {
      const acessos = { _papeis: f.papeis, _empresas: f.empresas, _setores: f.setores };
      if (!f.id) {
        const { error } = await bd.rpc("admin_pre_cadastrar", {
          _nome: f.nome.trim(),
          _email: f.email.trim().toLowerCase(),
          _pode_publicar_avisos: f.pode_publicar_avisos,
          ...acessos,
        });
        if (error) throw error;
        return;
      }
      const { error: e1 } = await bd.rpc("admin_atualizar_usuario", {
        _usuario_id: f.id,
        _dados: {
          nome: f.nome.trim(),
          email: f.email.trim().toLowerCase(),
          ativo: f.ativo,
          pode_publicar_avisos: f.pode_publicar_avisos,
        },
      });
      if (e1) throw e1;
      const { error: e2 } = await bd.rpc("admin_salvar_acessos", { _usuario_id: f.id, ...acessos });
      if (e2) throw e2;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["usuarios-acessos"] }),
  });
}
