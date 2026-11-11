import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnunciar } from "@/design-system/Anunciador";
import { usePessoasVisiveis, useRemanejar, type Ficha } from "./dados";

/** Só para supervisor e diretoria. Quem decide se pode é o banco (90 dias, equipe, empresa). */
export function RemanejarCliente({
  ficha,
  diasSemCompra,
}: {
  ficha: Ficha;
  diasSemCompra: number;
}) {
  const id = useId();
  const pessoas = (usePessoasVisiveis().data ?? []).filter(
    (p) => p.id !== ficha.cliente.vendedor_id,
  );
  const remanejar = useRemanejar(ficha.cliente.id);
  const anunciar = useAnunciar();
  const [novo, setNovo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo) return setErro("Escolha o vendedor que vai receber o cliente.");
    if (motivo.trim().length < 5) return setErro("Escreva o motivo, com pelo menos 5 caracteres.");
    setErro(null);
    try {
      await remanejar.mutateAsync({ novoVendedorId: novo, motivo });
      const nome = pessoas.find((p) => p.id === novo)?.nome ?? "o novo vendedor";
      toast.success(`Cliente passado para ${nome}.`);
      anunciar(`Cliente passado para ${nome}. A troca ficou registrada.`);
      setNovo("");
      setMotivo("");
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} className="cartao p-5">
      <h2 id={`${id}-t`} className="mb-1 text-lg font-bold">
        Mudar de carteira
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Só para clientes sem compra há {diasSemCompra} dias ou mais. A troca fica registrada no
        histórico.
      </p>
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-vendedor`}>Novo vendedor</Label>
          <Select value={novo} onValueChange={setNovo}>
            <SelectTrigger id={`${id}-vendedor`} className="min-h-11">
              <SelectValue placeholder="Escolha" />
            </SelectTrigger>
            <SelectContent>
              {pessoas.map((p) => (
                <SelectItem key={p.id} value={p.id} className="min-h-11">
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-motivo`}>Motivo</Label>
          <Input
            id={`${id}-motivo`}
            className="min-h-11"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
          />
        </div>
        {erro && (
          <p role="alert" className="text-sm font-semibold text-perigo sm:col-span-2">
            {erro}
          </p>
        )}
        <Button
          type="submit"
          variant="outline"
          className="justify-self-start"
          disabled={remanejar.isPending}
        >
          {remanejar.isPending ? "Mudando…" : "Mudar de carteira"}
        </Button>
      </form>
    </section>
  );
}
