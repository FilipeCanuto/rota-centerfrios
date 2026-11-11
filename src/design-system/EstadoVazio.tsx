import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EstadoVazio({
  icone: Icone,
  titulo,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="cartao entrada mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary-suave text-primary">
        <Icone className="size-7" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold">{titulo}</h2>
      <div className="max-w-md text-muted-foreground">{children}</div>
    </div>
  );
}
