import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAnunciar } from "@/design-system/Anunciador";
import { MIMES_ACEITOS, RECOMENDACAO_MIDIA, validarArquivoMidia } from "@/regras";
import { useSalvarMidiaLogin } from "./midiaLogin";

/** Envio de um arquivo novo: valida formato e peso antes de subir (o servidor confere de novo). */
export function EnvioMidiaLogin({ proximaOrdem }: { proximaOrdem: number }) {
  const id = useId();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const salvar = useSalvarMidiaLogin();
  const anunciar = useAnunciar();

  function escolher(f: File | undefined) {
    setErro(null);
    if (!f) return setArquivo(null);
    const v = validarArquivoMidia(f);
    if (!v.ok) {
      setArquivo(null);
      setErro(v.motivo);
      if (campo.current) campo.current.value = "";
      return;
    }
    setArquivo(f);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return setErro("Escolha o arquivo.");
    if (!texto.trim()) return setErro("Descreva a mídia no texto alternativo.");
    try {
      await salvar.mutateAsync({
        arquivo,
        texto_alternativo: texto.trim(),
        ordem: proximaOrdem,
        ativo: true,
      });
    } catch {
      return setErro("Não foi possível enviar. Confira o arquivo e tente de novo.");
    }
    setArquivo(null);
    setTexto("");
    setErro(null);
    if (campo.current) campo.current.value = "";
    toast.success("Mídia enviada.");
    anunciar("Mídia enviada.");
  }

  return (
    <form onSubmit={enviar} noValidate className="cartao flex flex-col gap-4 p-5">
      <h3 className="text-lg font-bold">Enviar nova mídia</h3>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-arq`}>Arquivo</Label>
        <Input
          ref={campo}
          id={`${id}-arq`}
          type="file"
          accept={MIMES_ACEITOS.join(",")}
          className="min-h-11 py-2"
          aria-describedby={`${id}-dica`}
          onChange={(e) => escolher(e.target.files?.[0])}
        />
        <p id={`${id}-dica`} className="text-sm text-muted-foreground">
          JPG, PNG, WebP, AVIF, GIF, MP4 ou WebM. Imagem e GIF até 5 MB; vídeo até 25 MB. No desktop
          o palco é quase quadrado; no tablet e no celular é uma faixa larga (veja as proporções
          reais na prévia). Recomendado: imagem {RECOMENDACAO_MIDIA.imagem}; vídeo{" "}
          {RECOMENDACAO_MIDIA.video}. Deixe o assunto no centro e ajuste depois em “Enquadrar”.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-alt`}>Texto alternativo (obrigatório)</Label>
        <Input
          id={`${id}-alt`}
          className="min-h-11"
          value={texto}
          maxLength={200}
          placeholder="Ex.: Equipe CENTERFRIOS na loja de Maceió"
          onChange={(e) => setTexto(e.target.value)}
          aria-invalid={!!erro && !texto.trim()}
        />
      </div>
      {erro && (
        <p role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      )}
      <Button type="submit" className="min-h-11 self-start" disabled={salvar.isPending}>
        <Upload aria-hidden="true" /> {salvar.isPending ? "Enviando…" : "Enviar mídia"}
      </Button>
    </form>
  );
}
