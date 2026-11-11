import { X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAnunciar } from "@/design-system/Anunciador";
import { useSalvarEtiquetas } from "./dados";

export function EtiquetasCliente({
  clienteId,
  etiquetas,
}: {
  clienteId: string;
  etiquetas: string[];
}) {
  const id = useId();
  const salvar = useSalvarEtiquetas(clienteId);
  const anunciar = useAnunciar();
  const [nova, setNova] = useState("");

  async function gravar(lista: string[], aviso: string) {
    try {
      await salvar.mutateAsync(lista);
      anunciar(aviso);
    } catch {
      toast.error("Não foi possível salvar as etiquetas.");
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} className="cartao p-5">
      <h2 id={`${id}-t`} className="mb-3 text-lg font-bold">
        Etiquetas
      </h2>
      {etiquetas.length === 0 ? (
        <p className="mb-3 text-muted-foreground">Nenhuma etiqueta ainda.</p>
      ) : (
        <ul className="mb-3 flex flex-wrap gap-2">
          {etiquetas.map((e) => (
            <li
              key={e}
              className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-3 pr-1"
            >
              {e}
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full"
                aria-label={`Tirar a etiqueta ${e}`}
                disabled={salvar.isPending}
                onClick={() =>
                  gravar(
                    etiquetas.filter((x) => x !== e),
                    `Etiqueta ${e} retirada.`,
                  )
                }
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          const t = nova.trim();
          if (!t || etiquetas.includes(t)) return;
          gravar([...etiquetas, t], `Etiqueta ${t} adicionada.`).then(() => setNova(""));
        }}
      >
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor={`${id}-nova`}>Nova etiqueta</Label>
          <Input
            id={`${id}-nova`}
            className="min-h-11"
            maxLength={30}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Ex.: Rede"
          />
        </div>
        <Button type="submit" variant="outline" disabled={salvar.isPending || !nova.trim()}>
          Adicionar
        </Button>
      </form>
    </section>
  );
}
