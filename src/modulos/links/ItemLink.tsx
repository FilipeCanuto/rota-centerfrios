import {
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  MessageCircle,
  Pencil,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useAcoesLink } from "./acoes";
import type { Link } from "./dados";

/** Nome da transição compartilhada entre o card e o detalhe do mesmo link. */
export const nomeTransicao = (id: string) => `link-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

/** Ícone do tipo (arquivo ou página) num quadro colorido pelo público. */
export function IconeLink({ link, paraCliente }: { link: Link; paraCliente: boolean }) {
  const Icone = link.arquivo_path ? FileText : Globe;
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center rounded-xl ${
        paraCliente ? "bg-primary-suave text-primary" : "bg-muted text-foreground"
      }`}
    >
      <Icone className="size-5" aria-hidden="true" />
    </span>
  );
}

/** Selo de público: sempre ícone e palavra. */
export function SeloPublico({ paraCliente }: { paraCliente: boolean }) {
  const Icone = paraCliente ? Users : Lock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${
        paraCliente ? "border-primary/40 text-primary" : "border-border text-foreground"
      }`}
    >
      <Icone className="size-4" aria-hidden="true" />
      {paraCliente ? "Cliente" : "Interno"}
    </span>
  );
}

export function ItemLink({
  link,
  empresa,
  podeEditar,
  emDetalhe,
  aoAbrirDetalhe,
  aoEditar,
}: {
  link: Link;
  empresa: string;
  podeEditar: boolean;
  /** O detalhe deste link está aberto: o nome da transição passa para o detalhe. */
  emDetalhe: boolean;
  aoAbrirDetalhe: () => void;
  aoEditar: () => void;
}) {
  const { paraCliente, abrir, copiar, whatsapp } = useAcoesLink(link);

  return (
    <li
      className={`cartao cartao-interativo flex flex-col gap-3 p-4 ${paraCliente ? "" : "border-dashed"}`}
      style={{ viewTransitionName: emDetalhe ? "none" : nomeTransicao(link.id) } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <IconeLink link={link} paraCliente={paraCliente} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-snug">
            {/* O botão cobre o card inteiro (::after); as ações ficam por cima dele. */}
            <button
              type="button"
              className="cursor-pointer rounded-sm text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
              aria-label={`Ver detalhes de ${link.titulo}`}
              onClick={aoAbrirDetalhe}
            >
              {link.titulo}
            </button>
          </h3>
          <p className="text-sm text-muted-foreground">{empresa}</p>
        </div>
        <span className="relative z-10 -mr-2 -mt-2 flex shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={copiar}
            aria-label={`Copiar link de ${link.titulo}`}
            title="Copiar link"
          >
            <Copy aria-hidden="true" />
          </Button>
          {podeEditar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={aoEditar}
              aria-label={`Editar ${link.titulo}`}
              title="Editar"
            >
              <Pencil aria-hidden="true" />
            </Button>
          )}
        </span>
      </div>
      {link.descricao && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{link.descricao}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SeloPublico paraCliente={paraCliente} />
        {!link.ativo && <SeloStatus tom="atencao">Inativo</SeloStatus>}
      </div>
      <div className="relative z-10 mt-auto flex gap-2 pt-1">
        <Button variant="suave" className="flex-1" onClick={abrir}>
          <ExternalLink aria-hidden="true" /> Abrir
        </Button>
        {paraCliente && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={whatsapp}
            aria-label="Enviar pelo WhatsApp"
          >
            <MessageCircle aria-hidden="true" /> WhatsApp
          </Button>
        )}
      </div>
    </li>
  );
}
