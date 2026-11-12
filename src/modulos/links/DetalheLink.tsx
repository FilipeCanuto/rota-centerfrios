import { Copy, ExternalLink, MessageCircle, Pencil } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useAcoesLink } from "./acoes";
import type { Link } from "./dados";
import { IconeLink, nomeTransicao, SeloPublico } from "./ItemLink";

function Conteudo({
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
  const { paraCliente, abrir, copiar, whatsapp } = useAcoesLink(link);
  return (
    <>
      <DialogHeader className="text-left">
        <div className="flex items-start gap-3 pr-10">
          <IconeLink link={link} paraCliente={paraCliente} />
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl font-bold leading-snug">
              {link.titulo}
            </DialogTitle>
            <DialogDescription>
              {link.arquivo_path ? "Arquivo" : "Link"} · {empresa}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <SeloPublico paraCliente={paraCliente} />
        {!link.ativo && <SeloStatus tom="atencao">Inativo</SeloStatus>}
      </div>
      {link.descricao && <p className="text-sm">{link.descricao}</p>}
      {paraCliente ? (
        link.mensagem_whatsapp && (
          <div className="rounded-xl bg-muted p-3 text-sm">
            <p className="font-semibold">Mensagem que vai junto no WhatsApp</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{link.mensagem_whatsapp}</p>
          </div>
        )
      ) : (
        <p className="rounded-xl border border-dashed p-3 text-sm">
          Uso interno do time. Não envie aos clientes.
        </p>
      )}
      {link.arquivo_path && (
        <p className="text-sm text-muted-foreground">
          O link copiado ou enviado de um arquivo vale por 7 dias.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={abrir}>
          <ExternalLink aria-hidden="true" /> Abrir
        </Button>
        {paraCliente && (
          <Button variant="outline" onClick={whatsapp}>
            <MessageCircle aria-hidden="true" /> Enviar pelo WhatsApp
          </Button>
        )}
        <Button variant="outline" onClick={copiar}>
          <Copy aria-hidden="true" /> Copiar link
        </Button>
        {podeEditar && (
          <Button variant="ghost" onClick={aoEditar}>
            <Pencil aria-hidden="true" /> Editar
          </Button>
        )}
      </div>
    </>
  );
}

/** Detalhe do link: o card se expande até aqui (mesmo view-transition-name). */
export function DetalheLink({
  link,
  empresa,
  podeEditar,
  aoFechar,
  aoEditar,
}: {
  link: Link | null;
  empresa: string;
  podeEditar: boolean;
  aoFechar: () => void;
  aoEditar: () => void;
}) {
  return (
    <Dialog open={!!link} onOpenChange={(aberto) => !aberto && aoFechar()}>
      {link && (
        <DialogContent
          className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl"
          style={{ viewTransitionName: nomeTransicao(link.id) } as CSSProperties}
        >
          <Conteudo link={link} empresa={empresa} podeEditar={podeEditar} aoEditar={aoEditar} />
        </DialogContent>
      )}
    </Dialog>
  );
}
