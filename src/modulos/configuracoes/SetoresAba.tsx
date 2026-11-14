import { Building2, Pencil, Plus } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAnunciar } from "@/design-system/Anunciador";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { SeloStatus } from "@/design-system/SeloStatus";
import { ICONES, iconeDoSetor, useCatalogo } from "@/modulos/setores/setores";
import { chaveDoSetor, validarSetor, type LinhaSetor } from "@/regras";
import { useSalvarSetor } from "./setoresAdmin";

function FormSetor({ setor, aoTerminar }: { setor: LinhaSetor | null; aoTerminar: () => void }) {
  const id = useId();
  const salvar = useSalvarSetor();
  const anunciar = useAnunciar();
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [icone, setIcone] = useState(setor?.icone ?? "building");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const chave = setor?.chave ?? chaveDoSetor(nome);
    const problema = validarSetor(nome, chave);
    setErro(problema);
    if (problema) return;
    try {
      await salvar.mutateAsync({ chave, nome, icone, novo: !setor, ativo: setor?.ativo ?? true });
    } catch {
      return setErro("Não foi possível salvar. Esse nome já existe?");
    }
    toast.success(setor ? "Setor atualizado." : "Setor criado.");
    anunciar(setor ? "Setor atualizado." : "Setor criado.");
    aoTerminar();
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-nome`}>Nome do setor</Label>
        <Input
          id={`${id}-nome`}
          className="min-h-11"
          value={nome}
          maxLength={60}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={!!erro}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-icone`}>Ícone</Label>
        <select
          id={`${id}-icone`}
          value={icone}
          onChange={(e) => setIcone(e.target.value)}
          className="min-h-11 rounded-md border bg-background px-3"
        >
          {Object.entries(ICONES).map(([valor, { rotulo }]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      {erro && (
        <p role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      )}
      <Button type="submit" className="min-h-11 self-start" disabled={salvar.isPending}>
        {salvar.isPending ? "Salvando…" : setor ? "Salvar" : "Criar setor"}
      </Button>
    </form>
  );
}

/** Aba "Setores": criar, renomear e ativar/desativar. Não exclui e não mexe em "disponível" (é do deploy). */
export default function SetoresAba() {
  const { data, isLoading, isError, refetch, isFetching } = useCatalogo();
  const salvar = useSalvarSetor();
  const anunciar = useAnunciar();
  // undefined = fechado; null = novo; linha = edição.
  const [editando, setEditando] = useState<LinhaSetor | null | undefined>(undefined);

  async function alternar(s: LinhaSetor, ativo: boolean) {
    try {
      await salvar.mutateAsync({
        chave: s.chave,
        nome: s.nome,
        icone: s.icone ?? "building",
        ativo,
      });
      anunciar(ativo ? "Setor ativado." : "Setor desativado.");
    } catch {
      toast.error("Não foi possível alterar o setor.");
    }
  }

  let corpo: React.ReactNode;
  if (isLoading)
    corpo = <Skeleton className="h-40 rounded-xl" role="status" aria-label="Carregando" />;
  else if (isError)
    corpo = (
      <EstadoErro
        titulo="Não foi possível carregar os setores"
        aoTentar={() => void refetch()}
        tentando={isFetching}
      >
        Confira a conexão e tente de novo.
      </EstadoErro>
    );
  else if (!data?.linhas.length)
    corpo = (
      <EstadoVazio icone={Building2} titulo="Nenhum setor cadastrado">
        Use “Novo setor” para criar o primeiro.
      </EstadoVazio>
    );
  else
    corpo = (
      <ul className="cascata flex flex-col gap-3" aria-label="Setores">
        {data.linhas.map((s) => {
          const Icone = iconeDoSetor(s.icone);
          return (
            <li key={s.chave} className="cartao flex flex-wrap items-center gap-3 p-4">
              <Icone className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
                <span className="font-bold">{s.nome}</span>
                <span className="text-sm text-foreground/80">Chave: {s.chave}</span>
              </div>
              {s.disponivel ? (
                <SeloStatus tom="sucesso">No ar</SeloStatus>
              ) : (
                <SeloStatus tom="atencao">Módulo em construção</SeloStatus>
              )}
              <div className="flex min-h-11 items-center gap-2">
                <Switch
                  id={`ativo-${s.chave}`}
                  checked={s.ativo}
                  onCheckedChange={(v) => void alternar(s, v)}
                  aria-label={`Ativo: ${s.nome}`}
                />
                <Label htmlFor={`ativo-${s.chave}`}>Ativo</Label>
              </div>
              <Button
                variant="outline"
                className="min-h-11"
                aria-label={`Renomear ${s.nome}`}
                onClick={() => setEditando(s)}
              >
                <Pencil aria-hidden="true" /> Editar
              </Button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Setores</h2>
          <p className="text-sm text-muted-foreground">
            Setor ativo pode receber acesso no cadastro. Ele só aparece no login quando o módulo
            estiver no ar. Setores não são excluídos, só desativados.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setEditando(null)}>
          <Plus aria-hidden="true" /> Novo setor
        </Button>
      </div>
      {corpo}
      <Dialog open={editando !== undefined} onOpenChange={(a) => !a && setEditando(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${editando.nome}` : "Novo setor"}</DialogTitle>
            <DialogDescription>A chave não muda depois de criada.</DialogDescription>
          </DialogHeader>
          {editando !== undefined && (
            <FormSetor setor={editando} aoTerminar={() => setEditando(undefined)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
