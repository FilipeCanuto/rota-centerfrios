import { Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnunciar } from "@/design-system/Anunciador";
import { useAdicionarNota, useApagarNota, type Ficha } from "./dados";

const quando = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Maceio",
});
const DIA = 86_400_000;

export function NotasCliente({ ficha, meuId }: { ficha: Ficha; meuId: string }) {
  const id = useId();
  const adicionar = useAdicionarNota(ficha.cliente, meuId);
  const apagar = useApagarNota(ficha.cliente.id);
  const anunciar = useAnunciar();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return setErro("Escreva a nota antes de salvar.");
    setErro(null);
    try {
      await adicionar.mutateAsync(texto);
      setTexto("");
      anunciar("Nota salva.");
    } catch (e) {
      setErro(
        `Não foi possível salvar a nota. ${(e as { message?: string }).message ?? ""}`.trim(),
      );
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} className="cartao p-5">
      <h2 id={`${id}-t`} className="mb-3 text-lg font-bold">
        Notas
      </h2>
      <form onSubmit={enviar} className="mb-4 grid gap-2" noValidate>
        <Label htmlFor={`${id}-texto`}>Nova nota</Label>
        <Textarea
          id={`${id}-texto`}
          maxLength={2000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-describedby={erro ? `${id}-erro` : undefined}
          aria-invalid={!!erro}
          placeholder="Ex.: prefere entrega pela manhã"
        />
        {erro && (
          <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-perigo">
            {erro}
          </p>
        )}
        <Button type="submit" className="justify-self-start" disabled={adicionar.isPending}>
          {adicionar.isPending ? "Salvando…" : "Salvar nota"}
        </Button>
      </form>
      {ficha.notas.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma nota ainda. Anote o que ajuda no próximo atendimento.
        </p>
      ) : (
        <ul className="divide-y">
          {ficha.notas.map((n) => {
            const podeApagar =
              n.autor_id === meuId && Date.now() - new Date(n.created_at).getTime() < DIA;
            return (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line">{n.texto}</p>
                  <p className="text-sm text-muted-foreground">
                    {n.autor_nome ?? "Equipe"} ·{" "}
                    <time dateTime={n.created_at}>{quando.format(new Date(n.created_at))}</time>
                  </p>
                </div>
                {podeApagar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Apagar esta nota"
                    disabled={apagar.isPending}
                    onClick={() =>
                      apagar.mutate(n.id, {
                        onSuccess: () =>
                          toast("Nota apagada.", {
                            action: { label: "Desfazer", onClick: () => adicionar.mutate(n.texto) },
                          }),
                        onError: (e) => toast.error((e as Error).message),
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
