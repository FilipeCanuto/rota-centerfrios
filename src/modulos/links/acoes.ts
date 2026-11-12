import { toast } from "sonner";
import { useAnunciar } from "@/design-system/Anunciador";
import { whatsappManual } from "@/integracoes/manual";
import { linkAssinado, type Link } from "./dados";
import { podeEnviarAoCliente } from "./publico";

/** Abre a aba já no clique (o navegador bloquearia depois da espera) e a isola da página. */
function abrirAba() {
  const janela = window.open("", "_blank");
  if (janela) janela.opener = null;
  return janela;
}

/** Ações de um link (abrir, copiar, WhatsApp), usadas no card e no detalhe. */
export function useAcoesLink(link: Link) {
  const anunciar = useAnunciar();
  const paraCliente = podeEnviarAoCliente(link);

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
      if (paraCliente) {
        toast.success(link.arquivo_path ? "Link copiado. Vale por 7 dias." : "Link copiado.");
        anunciar("Link copiado.");
      } else {
        toast.warning("Link copiado. Este link é interno. Não envie ao cliente.");
        anunciar("Link copiado. Este link é interno. Não envie ao cliente.");
      }
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  async function whatsapp() {
    if (!paraCliente) return;
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

  return { paraCliente, abrir, copiar, whatsapp };
}
