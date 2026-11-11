import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  extensao,
  LIMITE_ARQUIVO,
  TIPOS_ARQUIVO,
  useApagarLink,
  useSalvarLink,
  type Link,
  type LinkForm,
} from "./dados";

const VAZIO: LinkForm = {
  empresa_id: null,
  titulo: "",
  descricao: null,
  url: null,
  arquivo_path: null,
  mensagem_whatsapp: null,
  publico: "interno",
  ordem: 0,
  ativo: true,
};
const selecao =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2";

export function FormLink({
  aberto,
  link,
  empresas,
  aoFechar,
}: {
  aberto: boolean;
  /** Nulo = novo link. */
  link: Link | null;
  empresas: { id: string; nome: string }[];
  aoFechar: () => void;
}) {
  return (
    <Sheet open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-2xl overflow-y-auto rounded-t-xl"
      >
        {aberto && (
          <Corpo key={link?.id ?? "novo"} link={link} empresas={empresas} aoFechar={aoFechar} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Corpo({
  link,
  empresas,
  aoFechar,
}: {
  link: Link | null;
  empresas: { id: string; nome: string }[];
  aoFechar: () => void;
}) {
  const id = useId();
  const salvar = useSalvarLink();
  const apagar = useApagarLink();
  const [f, setF] = useState<LinkForm>(
    link ? { ...link, publico: link.publico as LinkForm["publico"] } : VAZIO,
  );
  const [erro, setErro] = useState<string | null>(null);
  const mudar = (p: Partial<LinkForm>) => setF((v) => ({ ...v, ...p }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const url = f.url?.trim() || null;
    if (!f.titulo.trim()) return setErro("Escreva o título.");
    if (!url && !f.arquivo && !f.arquivo_path)
      return setErro("Informe o endereço do link ou escolha um arquivo.");
    if (url && !/^https?:\/\//i.test(url))
      return setErro("O endereço deve começar com http:// ou https://.");
    if (f.arquivo) {
      if (!TIPOS_ARQUIVO.includes(extensao(f.arquivo.name)))
        return setErro("O arquivo deve ser PDF, JPG, PNG ou WEBP.");
      if (f.arquivo.size > LIMITE_ARQUIVO) return setErro("O arquivo passa de 20 MB.");
    }
    setErro(null);
    try {
      await salvar.mutateAsync({
        ...f,
        titulo: f.titulo.trim(),
        url,
        descricao: f.descricao?.trim() || null,
        mensagem_whatsapp: f.mensagem_whatsapp?.trim() || null,
      });
    } catch {
      return setErro("Não foi possível salvar. Confira a conexão e tente de novo.");
    }
    toast.success("Link salvo.");
    aoFechar();
  }

  async function excluir() {
    if (!link || !window.confirm("Apagar este link? Isso não pode ser desfeito.")) return;
    try {
      await apagar.mutateAsync(link);
    } catch {
      return setErro("Não foi possível apagar o link.");
    }
    toast.success("Link apagado.");
    aoFechar();
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display text-xl">
          {link ? "Editar link" : "Novo link"}
        </SheetTitle>
        <SheetDescription>
          Endereço da web ou arquivo (PDF, JPG, PNG, WEBP até 20 MB).
        </SheetDescription>
      </SheetHeader>
      <form onSubmit={enviar} className="mt-4 flex flex-col gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-t`}>Título</Label>
          <Input
            id={`${id}-t`}
            className="min-h-11"
            maxLength={120}
            value={f.titulo}
            onChange={(e) => mudar({ titulo: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-d`}>Descrição (opcional)</Label>
          <Input
            id={`${id}-d`}
            className="min-h-11"
            maxLength={240}
            value={f.descricao ?? ""}
            onChange={(e) => mudar({ descricao: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-u`}>Endereço do link</Label>
          <Input
            id={`${id}-u`}
            type="url"
            inputMode="url"
            className="min-h-11"
            value={f.url ?? ""}
            onChange={(e) => mudar({ url: e.target.value })}
            placeholder="https://"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-a`}>
            {f.arquivo_path ? "Trocar o arquivo (opcional)" : "Ou enviar um arquivo"}
          </Label>
          <Input
            id={`${id}-a`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="min-h-11"
            onChange={(e) => mudar({ arquivo: e.target.files?.[0] })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-m`}>Mensagem pronta para o WhatsApp (opcional)</Label>
          <Textarea
            id={`${id}-m`}
            maxLength={500}
            value={f.mensagem_whatsapp ?? ""}
            onChange={(e) => mudar({ mensagem_whatsapp: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-e`}>Vale para</Label>
            <select
              id={`${id}-e`}
              className={selecao}
              value={f.empresa_id ?? ""}
              onChange={(e) => mudar({ empresa_id: e.target.value || null })}
            >
              <option value="">As duas empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-p`}>Quem pode receber</Label>
            <select
              id={`${id}-p`}
              className={selecao}
              value={f.publico}
              onChange={(e) => mudar({ publico: e.target.value as LinkForm["publico"] })}
            >
              <option value="interno">Só a equipe</option>
              <option value="cliente">Pode ir ao cliente</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-o`}>Ordem</Label>
            <Input
              id={`${id}-o`}
              type="number"
              min={0}
              className="min-h-11"
              value={f.ordem}
              onChange={(e) => mudar({ ordem: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id={`${id}-ativo`}
            checked={f.ativo}
            onCheckedChange={(v) => mudar({ ativo: v })}
          />
          <Label htmlFor={`${id}-ativo`}>Ativo (aparece para a equipe)</Label>
        </div>
        {erro && (
          <p role="alert" className="font-semibold text-perigo">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={aoFechar}>
            Cancelar
          </Button>
          {link && (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 sm:ml-auto"
              onClick={excluir}
              disabled={apagar.isPending}
            >
              Apagar link
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
