import { Crop } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAnunciar } from "@/design-system/Anunciador";
import { limitarFoco, type Enquadramento } from "@/regras";
import { PreviaPalco } from "./PreviaPalco";
import { useSalvarMidiaLogin, type MidiaLogin } from "./midiaLogin";

type Item = MidiaLogin & { url?: string | undefined };

function Editor({ m, aoTerminar }: { m: Item; aoTerminar: () => void }) {
  const id = useId();
  const salvar = useSalvarMidiaLogin();
  const anunciar = useAnunciar();
  const [modo, setModo] = useState<Enquadramento>(m.enquadramento ?? "preencher");
  const [x, setX] = useState(m.foco_x ?? 50);
  const [y, setY] = useState(m.foco_y ?? 50);

  function clicar(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setX(limitarFoco(((e.clientX - r.left) / r.width) * 100));
    setY(limitarFoco(((e.clientY - r.top) / r.height) * 100));
  }
  async function gravar() {
    try {
      await salvar.mutateAsync({
        id: m.id,
        arquivo_path: m.arquivo_path,
        tipo: m.tipo,
        texto_alternativo: m.texto_alternativo,
        ordem: m.ordem,
        ativo: m.ativo,
        enquadramento: modo,
        foco_x: x,
        foco_y: y,
      });
    } catch {
      return void toast.error("Não foi possível salvar o enquadramento.");
    }
    toast.success("Enquadramento salvo.");
    anunciar("Enquadramento salvo.");
    aoTerminar();
  }

  const previa = [{ ...m, enquadramento: modo, foco_x: x, foco_y: y }];
  const midia = "max-h-64 min-h-16 min-w-24 w-auto max-w-full rounded-lg";
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Enquadramento</legend>
        {(
          [
            ["preencher", "Preencher", "Cobre todo o palco e corta o que passar das bordas."],
            [
              "ajustar",
              "Ajustar sem cortar",
              "Mostra a mídia inteira sobre um fundo desfocado dela.",
            ],
          ] as const
        ).map(([valor, rotulo, dica]) => (
          <label key={valor} className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="radio"
              name={`${id}-modo`}
              className="mt-1 size-5"
              checked={modo === valor}
              onChange={() => setModo(valor)}
            />
            <span className="font-medium">
              {rotulo}
              <span className="block text-sm font-normal text-muted-foreground">{dica}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {modo === "preencher" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Clique na mídia para marcar o ponto de foco: ele fica no centro do que for mostrado.
          </p>
          {m.url && (
            <div className="relative mx-auto w-fit max-w-full">
              <button
                type="button"
                onClick={clicar}
                aria-label="Definir o ponto de foco clicando na mídia"
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {m.tipo === "video" ? (
                  <video src={`${m.url}#t=0.1`} muted preload="metadata" className={midia} />
                ) : (
                  <img src={m.url} alt="" className={midia} />
                )}
              </button>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/60 shadow-[0_0_0_2px_rgba(0,0,0,.6)]"
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Foco horizontal", x, setX],
                ["Foco vertical", y, setY],
              ] as const
            ).map(([rotulo, valor, definir]) => (
              <div key={rotulo} className="grid gap-1 text-sm font-medium">
                <label htmlFor={`${id}-${rotulo}`}>
                  {rotulo}: {valor}%
                </label>
                <input
                  id={`${id}-${rotulo}`}
                  type="range"
                  min={0}
                  max={100}
                  value={valor}
                  className="min-h-11"
                  onChange={(e) => definir(limitarFoco(Number(e.target.value)))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <PreviaPalco itens={previa} />
      <Button
        className="min-h-11 self-start"
        onClick={() => void gravar()}
        disabled={salvar.isPending}
      >
        {salvar.isPending ? "Salvando…" : "Salvar enquadramento"}
      </Button>
    </div>
  );
}

/** Botão "Enquadrar" de uma mídia: modo, ponto de foco e prévia por aparelho antes de salvar. */
export function EnquadrarMidia({ m }: { m: Item }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`Enquadrar: ${m.texto_alternativo}`}
        >
          <Crop aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enquadrar mídia</DialogTitle>
          <DialogDescription>{m.texto_alternativo}</DialogDescription>
        </DialogHeader>
        {aberto && <Editor m={m} aoTerminar={() => setAberto(false)} />}
      </DialogContent>
    </Dialog>
  );
}
