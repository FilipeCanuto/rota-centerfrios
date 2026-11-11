import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Erro que explica o que aconteceu e o que fazer, com "Tentar de novo". Anunciado ao leitor de tela. */
export function EstadoErro({
  titulo,
  children,
  aoTentar,
  tentando = false,
}: {
  titulo: string;
  children?: React.ReactNode;
  aoTentar?: () => void;
  /** Verdadeiro enquanto busca de novo: desativa o botão e mostra "Tentando…". */
  tentando?: boolean;
}) {
  return (
    <div role="alert" className="cartao entrada flex flex-col items-start gap-3 p-5">
      <p className="flex items-center gap-2 font-semibold text-perigo">
        <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
        {titulo}
      </p>
      <p className="text-muted-foreground">
        {children ??
          "Verifique a conexão com a internet e tente de novo. Se continuar, avise o administrador."}
      </p>
      {aoTentar && (
        <Button variant="outline" onClick={aoTentar} disabled={tentando}>
          {tentando ? "Tentando…" : "Tentar de novo"}
        </Button>
      )}
    </div>
  );
}
