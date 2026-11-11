import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ABRANGENCIAS,
  explicarErro,
  useSalvarFeriado,
  type Abrangencia,
  type Feriado,
  type NovoFeriado,
} from "./dados";

const TODAS = "todas";

/** Painel que sobe da base para adicionar ou editar uma data. `inicial` nulo = nova data. */
export function FormFeriado({
  aberto,
  inicial,
  empresas,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  inicial: Feriado | null;
  empresas: { id: string; nome: string }[];
  aoFechar: () => void;
  aoSalvar: (f: NovoFeriado) => void;
}) {
  const id = useId();
  const salvar = useSalvarFeriado();
  const dataRef = useRef<HTMLInputElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<NovoFeriado>(vazio());
  const [erros, setErros] = useState<{
    data?: string | undefined;
    nome?: string | undefined;
    geral?: string | undefined;
  }>({});

  useEffect(() => {
    if (aberto) {
      setF(inicial ?? vazio());
      setErros({});
    }
  }, [aberto, inicial]);

  const mudar = (p: Partial<NovoFeriado>) => setF((v) => ({ ...v, ...p }));
  const mostraLocal = f.abrangencia === "estadual" || f.abrangencia === "municipal";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const novos = {
      data: f.data ? undefined : "Informe a data.",
      nome: f.nome.trim() ? undefined : "Informe o nome.",
    };
    setErros(novos);
    if (novos.data) return dataRef.current?.focus();
    if (novos.nome) return nomeRef.current?.focus();
    const linha: NovoFeriado = {
      ...f,
      empresa_id: f.abrangencia === "nacional" ? null : f.empresa_id,
      localidade: mostraLocal ? f.localidade : null,
    };
    try {
      await salvar.mutateAsync(linha);
      aoSalvar(linha);
    } catch (err) {
      setErros({ geral: explicarErro(err) });
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
            {inicial ? "Editar data" : "Adicionar data"}
          </SheetTitle>
          <SheetDescription>
            Datas sem expediente não contam como dia útil nas metas e nos prazos.
          </SheetDescription>
        </SheetHeader>
        <form className="mt-4 flex flex-col gap-5" onSubmit={enviar} noValidate>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-data`}>Data</Label>
              <Input
                ref={dataRef}
                id={`${id}-data`}
                type="date"
                className="min-h-11"
                value={f.data}
                onChange={(e) => mudar({ data: e.target.value })}
                required
                aria-invalid={!!erros.data}
                aria-describedby={erros.data ? `${id}-data-erro` : undefined}
              />
              {erros.data && (
                <p id={`${id}-data-erro`} className="text-sm font-semibold text-perigo">
                  {erros.data}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-nome`}>Nome</Label>
              <Input
                ref={nomeRef}
                id={`${id}-nome`}
                className="min-h-11"
                value={f.nome}
                onChange={(e) => mudar({ nome: e.target.value })}
                placeholder="Ex.: Carnaval"
                required
                aria-invalid={!!erros.nome}
                aria-describedby={erros.nome ? `${id}-nome-erro` : undefined}
              />
              {erros.nome && (
                <p id={`${id}-nome-erro`} className="text-sm font-semibold text-perigo">
                  {erros.nome}
                </p>
              )}
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 font-semibold">Abrangência</legend>
            <RadioGroup
              value={f.abrangencia}
              onValueChange={(v) => mudar({ abrangencia: v as Abrangencia })}
              className="grid gap-2 sm:grid-cols-2"
            >
              {ABRANGENCIAS.map((a) => (
                <Label
                  key={a.valor}
                  htmlFor={`${id}-${a.valor}`}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[:checked]:border-primary"
                >
                  <RadioGroupItem id={`${id}-${a.valor}`} value={a.valor} className="mt-0.5" />
                  <span>
                    <span className="block font-semibold">{a.rotulo}</span>
                    <span className="text-sm text-muted-foreground">{a.dica}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          {f.abrangencia !== "nacional" && empresas.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-empresa`}>Vale para</Label>
              <Select
                value={f.empresa_id ?? TODAS}
                onValueChange={(v) => mudar({ empresa_id: v === TODAS ? null : v })}
              >
                <SelectTrigger id={`${id}-empresa`} className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS} className="min-h-11">
                    Todas as empresas
                  </SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="min-h-11">
                      Só {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mostraLocal && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-local`}>
                {f.abrangencia === "estadual" ? "Estado (opcional)" : "Cidade (opcional)"}
              </Label>
              <Input
                id={`${id}-local`}
                className="min-h-11"
                value={f.localidade ?? ""}
                onChange={(e) => mudar({ localidade: e.target.value })}
                placeholder={f.abrangencia === "estadual" ? "Ex.: AL" : "Ex.: Maceió"}
              />
            </div>
          )}

          <div className="flex min-h-11 items-start gap-3">
            <Checkbox
              id={`${id}-movel`}
              checked={f.data_movel}
              onCheckedChange={(v) => mudar({ data_movel: v === true })}
              className="mt-1"
            />
            <Label htmlFor={`${id}-movel`} className="font-normal">
              <span className="block font-semibold">A data muda a cada ano</span>
              <span className="text-sm text-muted-foreground">
                Como Carnaval e Paixão de Cristo. Datas móveis não são copiadas para o ano seguinte.
              </span>
            </Label>
          </div>

          {erros.geral && (
            <p role="alert" className="font-semibold text-perigo">
              {erros.geral}
            </p>
          )}
          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar data"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function vazio(): NovoFeriado {
  return {
    data: "",
    nome: "",
    abrangencia: "empresa",
    localidade: null,
    empresa_id: null,
    data_movel: false,
  };
}
