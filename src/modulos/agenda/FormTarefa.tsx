import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_TAREFA, useSalvarTarefa, type NovaTarefa, type TipoTarefa } from "./dados";

/** Painel para criar ou editar uma tarefa. `inicial` traz a tarefa a editar ou o cliente já escolhido. */
export function FormTarefa({
  aberto,
  inicial,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  inicial: NovaTarefa & { nomeCliente?: string | undefined };
  aoFechar: () => void;
  aoSalvar: (t: NovaTarefa) => void;
}) {
  const id = useId();
  const salvar = useSalvarTarefa();
  const tituloRef = useRef<HTMLInputElement>(null);
  const [t, setT] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (aberto) {
      setT(inicial);
      setErro(null);
    }
  }, [aberto, inicial]);
  const mudar = (p: Partial<NovaTarefa>) => setT((v) => ({ ...v, ...p }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!t.titulo.trim()) {
      setErro("Escreva o que fazer.");
      return tituloRef.current?.focus();
    }
    if (!t.data) return setErro("Escolha a data.");
    setErro(null);
    const linha: NovaTarefa = {
      ...t,
      titulo: t.titulo.trim(),
      hora: t.hora || null,
      observacao: t.observacao?.trim() || null,
    };
    try {
      await salvar.mutateAsync(linha);
      aoSalvar(linha);
    } catch {
      setErro("Não foi possível salvar a tarefa. Tente de novo.");
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-2xl overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            {inicial.id ? "Editar tarefa" : "Nova tarefa"}
          </SheetTitle>
          <SheetDescription>
            {inicial.nomeCliente
              ? `Cliente: ${inicial.nomeCliente}`
              : "Retorno, visita, ligação ou tarefa."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={enviar} className="mt-4 flex flex-col gap-5" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-titulo`}>O que fazer</Label>
            <Input
              ref={tituloRef}
              id={`${id}-titulo`}
              className="min-h-11"
              maxLength={120}
              value={t.titulo}
              onChange={(e) => mudar({ titulo: e.target.value })}
              placeholder="Ex.: ligar para fechar o pedido"
            />
          </div>
          <fieldset>
            <legend className="mb-2 font-semibold">Tipo</legend>
            <RadioGroup
              value={t.tipo}
              onValueChange={(v) => mudar({ tipo: v as TipoTarefa })}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {TIPOS_TAREFA.map((o) => (
                <Label
                  key={o.valor}
                  htmlFor={`${id}-${o.valor}`}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 font-normal has-[:checked]:border-primary"
                >
                  <RadioGroupItem id={`${id}-${o.valor}`} value={o.valor} />
                  {o.rotulo}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-data`}>Data</Label>
              <Input
                id={`${id}-data`}
                type="date"
                className="min-h-11"
                value={t.data}
                onChange={(e) => mudar({ data: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-hora`}>Hora (opcional)</Label>
              <Input
                id={`${id}-hora`}
                type="time"
                className="min-h-11"
                value={t.hora?.slice(0, 5) ?? ""}
                onChange={(e) => mudar({ hora: e.target.value || null })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-obs`}>Observação (opcional)</Label>
            <Textarea
              id={`${id}-obs`}
              maxLength={500}
              value={t.observacao ?? ""}
              onChange={(e) => mudar({ observacao: e.target.value })}
            />
          </div>
          {erro && (
            <p role="alert" className="font-semibold text-perigo">
              {erro}
            </p>
          )}
          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar tarefa"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
