import { Pencil, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useCatalogo } from "@/modulos/setores/setores";
import { FormUsuario } from "./FormUsuario";
import { PAPEIS, useUsuariosAcessos, type UsuarioAcessos } from "./usuarios";

const rotuloPapel = (p: string) => PAPEIS.find((x) => x.valor === p)?.rotulo ?? p;

export default function UsuariosAba() {
  const { data, isLoading, isError, refetch, isFetching } = useUsuariosAcessos();
  const { data: catalogo } = useCatalogo();
  const nomeSetor = (c: string) => catalogo?.linhas.find((l) => l.chave === c)?.nome ?? c;
  // undefined = fechado; null = pré-cadastro; usuário = edição.
  const [editando, setEditando] = useState<UsuarioAcessos | null | undefined>(undefined);

  let corpo: React.ReactNode;
  if (isLoading)
    corpo = <Skeleton className="h-40 rounded-xl" role="status" aria-label="Carregando" />;
  else if (isError)
    corpo = (
      <EstadoErro
        titulo="Não foi possível carregar os usuários"
        aoTentar={() => void refetch()}
        tentando={isFetching}
      >
        Confira a conexão e tente de novo.
      </EstadoErro>
    );
  else if (!data?.length)
    corpo = (
      <EstadoVazio icone={Users} titulo="Nenhum usuário cadastrado">
        Use “Pré-cadastrar” para liberar o primeiro acesso.
      </EstadoVazio>
    );
  else
    corpo = (
      <ul className="cascata flex flex-col gap-3" aria-label="Usuários">
        {data.map((u) => (
          <li key={u.id} className="cartao linha-interativa flex flex-wrap items-center gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-bold">{u.nome}</span>
              <span className="break-all text-sm text-foreground/80">
                {u.email ?? "Sem e-mail"}
              </span>
              <span className="text-sm">
                {u.papeis.map(rotuloPapel).join(", ") || "Sem papel"} ·{" "}
                {u.setores.map((s) => nomeSetor(s)).join(", ") || "Sem setor"}
              </span>
            </div>
            {!u.ativo ? (
              <SeloStatus tom="perigo">Inativa</SeloStatus>
            ) : u.temLogin ? (
              <SeloStatus tom="sucesso">Ativa</SeloStatus>
            ) : (
              <SeloStatus tom="atencao">Convite pendente</SeloStatus>
            )}
            <Button
              variant="outline"
              className="min-h-11"
              aria-label={`Editar acessos de ${u.nome}`}
              onClick={() => setEditando(u)}
            >
              <Pencil aria-hidden="true" /> Editar
            </Button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground/80">
          Papel, empresas e setores de cada pessoa. Toda alteração fica na auditoria.
        </p>
        <Button className="min-h-11" onClick={() => setEditando(null)}>
          <UserPlus aria-hidden="true" /> Pré-cadastrar
        </Button>
      </div>
      {corpo}
      <Dialog open={editando !== undefined} onOpenChange={(v) => !v && setEditando(undefined)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? `Acessos de ${editando.nome}` : "Pré-cadastrar usuário"}
            </DialogTitle>
            <DialogDescription>
              {editando
                ? "Marque pelo menos um setor. A pessoa só entra nos setores marcados."
                : "A pessoa entra com o e-mail da empresa pelo “Primeiro acesso”."}
            </DialogDescription>
          </DialogHeader>
          {editando !== undefined && (
            <FormUsuario
              key={editando?.id ?? "novo"}
              usuario={editando}
              aoTerminar={() => setEditando(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
