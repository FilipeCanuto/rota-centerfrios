import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAVES_PESO, useAjustes, useSalvarAjustes } from "./dados";

/** Pesos e hashtag da campanha: só a diretoria enxerga e grava (RLS de configuracoes_*). */
export function AjustesGamificacao({ empresaId }: { empresaId: string }) {
  const q = useAjustes(empresaId, true);
  if (!q.data) return null;
  return <Form key={JSON.stringify(q.data)} empresaId={empresaId} inicial={q.data} />;
}

function Form({
  empresaId,
  inicial,
}: {
  empresaId: string;
  inicial: { pesos: Record<string, number>; hashtag: string };
}) {
  const id = useId();
  const salvar = useSalvarAjustes(empresaId);
  const [pesos, setPesos] = useState<Record<string, string>>(
    Object.fromEntries(CHAVES_PESO.map((c) => [c.chave, String(inicial.pesos[c.chave] ?? 0)])),
  );
  const [hashtag, setHashtag] = useState(inicial.hashtag);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const numeros = Object.fromEntries(CHAVES_PESO.map((c) => [c.chave, Number(pesos[c.chave])]));
    if (Object.values(numeros).some((n) => !Number.isInteger(n) || n < 0))
      return setErro("Os pesos devem ser números inteiros, zero ou maiores.");
    setErro(null);
    try {
      await salvar.mutateAsync({ pesos: numeros, hashtag });
    } catch {
      return setErro("Não foi possível salvar os ajustes.");
    }
    toast.success("Ajustes salvos. Valem para os próximos cálculos de pontos.");
  }

  return (
    <form onSubmit={enviar} className="cartao grid gap-4 p-5" noValidate>
      <h3 className="text-lg font-bold">Ajustes da pontuação (diretoria)</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CHAVES_PESO.map((c) => (
          <div key={c.chave} className="grid gap-1.5">
            <Label htmlFor={`${id}-${c.chave}`}>{c.rotulo}</Label>
            <Input
              id={`${id}-${c.chave}`}
              type="number"
              min={0}
              step={1}
              className="min-h-11"
              value={pesos[c.chave] ?? ""}
              onChange={(e) => setPesos((p) => ({ ...p, [c.chave]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor={`${id}-h`}>Hashtag da campanha</Label>
        <Input
          id={`${id}-h`}
          className="min-h-11"
          value={hashtag}
          onChange={(e) => setHashtag(e.target.value)}
          placeholder="#exemplo (vazia = só @centerfriosoficial)"
        />
      </div>
      {erro && (
        <p role="alert" className="font-semibold text-perigo">
          {erro}
        </p>
      )}
      <Button type="submit" className="min-h-11 w-fit" disabled={salvar.isPending}>
        {salvar.isPending ? "Salvando…" : "Salvar ajustes"}
      </Button>
    </form>
  );
}
