import { Copy, ExternalLink, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAnunciar } from "@/design-system/Anunciador";
import { SeloStatus } from "@/design-system/SeloStatus";
import { whatsappManual } from "@/integracoes/manual";
import { linkAssinado, type Link } from "./dados";

/** Abre a aba já no clique (o navegador bloquearia depois da espera) e a isola da página. */
function abrirAba() {
  const janela = window.open("", "_blank");
  if (janela) janela.opener = null;
  return janela;
}

export function ItemLink({
  link,
  empresa,
  podeEditar,
  aoEditar,
}: {
  link: Link;
  empresa: string;
  podeEditar: boolean;
  aoEditar: () => void;
}) {
  const anunciar = useAnunciar();

  /** Endereço a enviar: o link, ou o link temporário (7 dias) do arquivo. */
  async function endereco() {
    const alvo = link.arquivo_path ? await linkAssinado(link.arquivo_path) : (link.url ?? "");
    // Só http(s): a coluna do banco aceita qualquer texto, e "javascript:" não pode chegar ao navegador.
    if (!/^https?:\/\//i.test(alvo)) throw new Error("Endereço inválido");
    return alvo;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(await endereco());
      toast.success(link.arquivo_path ? "Link copiado. Vale por 7 dias." : "Link copiado.");
      anunciar("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  async function whatsapp() {
    // Abre a janela já no clique; o navegador bloquearia depois da espera.
    const janela = abrirAba();
    try {
      const texto = [link.mensagem_whatsapp, await endereco()].filter(Boolean).join("\n");
      const alvo = whatsappManual.abrirConversa("", texto);
      if (janela) janela.location.href = alvo;
      else window.location.href = alvo;
    } catch {
      janela?.close();
      toast.error("Não foi possível preparar a mensagem.");
    }
  }

  async function abrir() {
    const janela = abrirAba();
    try {
      const alvo = await endereco();
      if (janela) janela.location.href = alvo;
      else window.location.href = alvo;
    } catch {
      janela?.close();
      toast.error("Não foi possível abrir o arquivo.");
    }
  }

  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{link.titulo}</h3>
        <SeloStatus tom="info">{link.arquivo_path ? "Arquivo" : "Link"}</SeloStatus>
        {!link.ativo && <SeloStatus tom="atencao">Inativo</SeloStatus>}
        <span className="ml-auto text-sm text-muted-foreground">{empresa}</span>
      </div>
      {link.descricao && <p className="text-sm text-muted-foreground">{link.descricao}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={abrir}>
          <ExternalLink aria-hidden="true" /> Abrir
        </Button>
        <Button variant="outline" className="min-h-11" onClick={copiar}>
          <Copy aria-hidden="true" /> Copiar link
        </Button>
        <Button variant="outline" className="min-h-11" onClick={whatsapp}>
          <MessageCircle aria-hidden="true" /> Enviar pelo WhatsApp
        </Button>
        {podeEditar && (
          <Button variant="ghost" className="min-h-11" onClick={aoEditar}>
            <Pencil aria-hidden="true" /> Editar
          </Button>
        )}
      </div>
    </li>
  );
}
