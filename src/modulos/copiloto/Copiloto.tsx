import { ChevronDown, ChevronUp, Settings2, Volume2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Pinguim } from "@/design-system/Pinguim";
import { integracoes } from "@/integracoes";
import type { Sessao } from "@/modulos/sessao/sessao";
import { apelidoValido, expressaoDoCopiloto, VERSOES_PINGUIM, type VersaoPinguim } from "@/regras";
import { useAtualizarCopiloto } from "./dados";

type Usuario = NonNullable<Sessao["usuario"]>;
interface Contexto {
  clientesHoje: number;
  orcamentosParados: number;
  atingimento: number;
}

/** Mensagem do dia por regras e modelos, com o apelido e o Pinguim que o vendedor escolheu. */
export function Copiloto({ usuario, contexto }: { usuario: Usuario; contexto: Contexto }) {
  const atualizar = useAtualizarCopiloto(usuario.id);
  const [ajustes, setAjustes] = useState(false);
  const msg = integracoes.copiloto.mensagemDoDia({
    apelido: usuario.apelido_copiloto,
    ...contexto,
  });
  const expressao = expressaoDoCopiloto(contexto);
  const minimizado = usuario.copiloto_minimizado;
  const voz = integracoes.voz;

  return (
    <section aria-label="Copiloto" className="cartao entrada flex flex-col gap-3 p-5">
      <div className="flex items-center gap-4">
        <Pinguim
          className={
            minimizado ? "size-10 shrink-0 text-foreground" : "size-14 shrink-0 text-foreground"
          }
          expressao={expressao}
          versao={usuario.pinguim_versao}
        />
        {minimizado ? (
          <p className="font-semibold">{usuario.apelido_copiloto}</p>
        ) : (
          <p className="font-display text-lg font-semibold leading-snug">{msg}</p>
        )}
        <Button
          variant="ghost"
          className="ml-auto min-h-11 min-w-11 shrink-0"
          aria-expanded={!minimizado}
          aria-label={minimizado ? "Mostrar o copiloto" : "Minimizar o copiloto"}
          disabled={atualizar.isPending}
          onClick={() =>
            atualizar.mutate(
              { copiloto_minimizado: !minimizado },
              { onError: () => toast.error("Não foi possível salvar. Tente de novo.") },
            )
          }
        >
          {minimizado ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </Button>
      </div>
      {!minimizado && (
        <div className="flex flex-wrap gap-2">
          {voz.disponivel() && (
            <Button variant="outline" className="min-h-11" onClick={() => voz.falar(msg)}>
              <Volume2 aria-hidden="true" /> Ouvir
            </Button>
          )}
          <Button variant="outline" className="min-h-11" onClick={() => setAjustes(true)}>
            <Settings2 aria-hidden="true" /> Personalizar
          </Button>
        </div>
      )}
      <Sheet open={ajustes} onOpenChange={setAjustes}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] max-w-2xl overflow-y-auto rounded-t-xl"
        >
          {ajustes && <Personalizar usuario={usuario} aoFechar={() => setAjustes(false)} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Personalizar({ usuario, aoFechar }: { usuario: Usuario; aoFechar: () => void }) {
  const id = useId();
  const atualizar = useAtualizarCopiloto(usuario.id);
  const [apelido, setApelido] = useState(usuario.apelido_copiloto);
  const [versao, setVersao] = useState<VersaoPinguim>(usuario.pinguim_versao);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const a = apelidoValido(apelido);
    if (!a) return setErro("O apelido deve ter de 2 a 20 letras.");
    setErro(null);
    try {
      await atualizar.mutateAsync({ apelido_copiloto: a, pinguim_versao: versao });
    } catch {
      return setErro("Não foi possível salvar. Tente de novo.");
    }
    toast.success("Copiloto atualizado.");
    aoFechar();
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display text-xl">Personalizar o copiloto</SheetTitle>
        <SheetDescription>Escolha o apelido e a versão do Pinguim.</SheetDescription>
      </SheetHeader>
      <form onSubmit={salvar} className="mt-4 flex flex-col gap-5" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-a`}>Apelido</Label>
          <Input
            id={`${id}-a`}
            className="min-h-11"
            maxLength={20}
            value={apelido}
            aria-invalid={!!erro}
            onChange={(e) => setApelido(e.target.value)}
          />
        </div>
        <fieldset>
          <legend className="mb-2 font-semibold">Versão do Pinguim</legend>
          <RadioGroup
            value={versao}
            onValueChange={(v) => setVersao(v as VersaoPinguim)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {VERSOES_PINGUIM.map((o) => (
              <Label
                key={o.valor}
                htmlFor={`${id}-${o.valor}`}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 font-normal has-[:checked]:border-primary"
              >
                <RadioGroupItem id={`${id}-${o.valor}`} value={o.valor} />
                <Pinguim className="size-8 text-foreground" versao={o.valor} />
                {o.rotulo}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        {erro && (
          <p role="alert" className="font-semibold text-perigo">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={atualizar.isPending}>
            {atualizar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={aoFechar}>
            Cancelar
          </Button>
        </div>
      </form>
    </>
  );
}
