import { useRef } from "react";
import { useViva } from "./useViva";

export function Progresso({ valor, rotulo }: { valor: number; rotulo: string }) {
  const p = Math.max(0, Math.min(1, valor));
  const atingido = valor >= 1;
  const raiz = useRef<HTMLDivElement>(null);
  const viva = useViva(raiz);
  return (
    <div
      ref={raiz}
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      className="h-2 w-full overflow-hidden rounded-full bg-trilha"
    >
      <div
        // Reflexo "vivo" só com a barra na tela e a aba visível (useViva), como a barra da meta.
        data-viva={viva}
        className={`reflexo reflexo-vivo h-full rounded-full barra-entrar ${atingido ? "bg-ouro ring-2 ring-foreground ring-inset" : "bg-primary"}`}
        style={{ width: `${p * 100}%` }}
      />
    </div>
  );
}
