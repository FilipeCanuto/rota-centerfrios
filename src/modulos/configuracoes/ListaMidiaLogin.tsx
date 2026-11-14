import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAnunciar } from "@/design-system/Anunciador";
import { EnquadrarMidia } from "./EnquadrarMidia";
import { moverItem } from "@/regras";
import {
  useApagarMidiaLogin,
  useReordenarMidiaLogin,
  useSalvarMidiaLogin,
  type MidiaLogin,
} from "./midiaLogin";

type Item = MidiaLogin & { url?: string | undefined };
const ROTULO_TIPO = { imagem: "Imagem", animacao: "GIF", video: "Vídeo" } as const;

function Miniatura({ m }: { m: Item }) {
  const base = "h-16 w-24 shrink-0 rounded-md bg-muted object-cover";
  if (!m.url) return <div className={base} aria-hidden="true" />;
  return m.tipo === "video" ? (
    <video src={`${m.url}#t=0.1`} muted preload="metadata" className={base} aria-hidden="true" />
  ) : (
    <img src={m.url} alt="" className={base} />
  );
}

/** Lista ordenável: arrastar pela alça ou usar os botões subir/descer (teclado e leitor de tela). */
export function ListaMidiaLogin({ itens }: { itens: Item[] }) {
  const reordenar = useReordenarMidiaLogin();
  const salvar = useSalvarMidiaLogin();
  const apagar = useApagarMidiaLogin();
  const anunciar = useAnunciar();
  const [arrastando, setArrastando] = useState<number | null>(null);

  async function mover(de: number, para: number) {
    if (para < 0 || para >= itens.length || de === para) return;
    try {
      await reordenar.mutateAsync(moverItem(itens, de, para).map((m) => m.id));
      anunciar(`Mídia movida para a posição ${para + 1}.`);
    } catch {
      toast.error("Não foi possível reordenar.");
    }
  }
  async function alternar(m: Item, ativo: boolean) {
    try {
      await salvar.mutateAsync({
        id: m.id,
        arquivo_path: m.arquivo_path,
        tipo: m.tipo,
        texto_alternativo: m.texto_alternativo,
        ordem: m.ordem,
        ativo,
        enquadramento: m.enquadramento,
        foco_x: m.foco_x,
        foco_y: m.foco_y,
      });
      anunciar(ativo ? "Mídia ativada." : "Mídia desativada.");
    } catch {
      toast.error("Não foi possível alterar a mídia.");
    }
  }
  async function excluir(m: Item) {
    try {
      await apagar.mutateAsync(m);
      toast.success("Mídia excluída.");
      anunciar("Mídia excluída.");
    } catch {
      toast.error("Não foi possível excluir.");
    }
  }

  return (
    <ol className="flex flex-col gap-2" aria-label="Mídias do login, na ordem de exibição">
      {itens.map((m, i) => (
        <li
          key={m.id}
          draggable
          onDragStart={() => setArrastando(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (arrastando !== null) void mover(arrastando, i);
            setArrastando(null);
          }}
          onDragEnd={() => setArrastando(null)}
          className={`cartao flex flex-wrap items-center gap-3 p-3 ${arrastando === i ? "opacity-50" : ""}`}
        >
          <GripVertical
            aria-hidden="true"
            className="size-5 shrink-0 cursor-grab text-muted-foreground"
          />
          <Miniatura m={m} />
          <div className="min-w-0 flex-1 basis-40">
            <p className="break-words font-semibold">{m.texto_alternativo}</p>
            <p className="text-sm text-muted-foreground">
              {i + 1}º · {ROTULO_TIPO[m.tipo]} · {m.ativo ? "Ativa" : "Desativada"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              disabled={i === 0}
              aria-label={`Subir: ${m.texto_alternativo}`}
              onClick={() => void mover(i, i - 1)}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              disabled={i === itens.length - 1}
              aria-label={`Descer: ${m.texto_alternativo}`}
              onClick={() => void mover(i, i + 1)}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <EnquadrarMidia m={m} />
            <div className="flex min-h-11 items-center gap-2 px-2">
              <Switch
                id={`ativa-${m.id}`}
                checked={m.ativo}
                onCheckedChange={(v) => void alternar(m, v)}
                aria-label={`Ativa: ${m.texto_alternativo}`}
              />
              <Label htmlFor={`ativa-${m.id}`} className="text-sm font-medium">
                Ativa
              </Label>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 text-perigo"
                  aria-label={`Excluir: ${m.texto_alternativo}`}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir esta mídia?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{m.texto_alternativo}” sai do login e o arquivo é apagado. Essa ação não pode
                    ser desfeita. Para só esconder, desative.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="min-h-11" onClick={() => void excluir(m)}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </li>
      ))}
    </ol>
  );
}
