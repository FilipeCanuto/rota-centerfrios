import { AlertTriangle, CheckCircle2, CircleAlert, Info, Star } from "lucide-react";
import type { ReactNode } from "react";

export type TomStatus = "sucesso" | "atencao" | "perigo" | "info" | "conquista";

const tons: Record<TomStatus, { classe: string; Icone: typeof Info }> = {
  sucesso: { classe: "text-sucesso border-sucesso/40", Icone: CheckCircle2 },
  atencao: { classe: "text-atencao border-atencao/40", Icone: AlertTriangle },
  perigo: { classe: "text-perigo border-perigo/40", Icone: CircleAlert },
  info: { classe: "text-primary border-primary/30", Icone: Info },
  conquista: { classe: "bg-ouro text-ouro-foreground border-transparent", Icone: Star },
};

/** Status sempre com ícone + palavra, nunca só cor. */
export function SeloStatus({ tom, children }: { tom: TomStatus; children: ReactNode }) {
  const { classe, Icone } = tons[tom];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${classe}`}>
      <Icone className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}
