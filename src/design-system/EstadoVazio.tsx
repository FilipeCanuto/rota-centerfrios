import type { LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Mascote } from "./Mascote";
import { useViva } from "./useViva";

/** Estado vazio com o mascote (decorativo) e o ícone do assunto como selo. */
export function EstadoVazio({
  icone: Icone,
  titulo,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  children: ReactNode;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const viva = useViva(raiz);
  return (
    <div
      ref={raiz}
      className="cartao entrada mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-12 text-center"
    >
      <div className="relative">
        <Mascote tamanho={120} estado="pensando" animado={viva} />
        <div className="absolute -bottom-1 -right-3 grid size-11 place-items-center rounded-full border-2 border-card bg-primary-suave text-primary">
          <Icone className="size-5" aria-hidden="true" />
        </div>
      </div>
      <h2 className="text-xl font-bold">{titulo}</h2>
      <div className="max-w-md text-muted-foreground">{children}</div>
    </div>
  );
}
