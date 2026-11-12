import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rotaPai } from "@/regras/rotas";

/**
 * Voltar único do app: usa o histórico do próprio app e, sem histórico (acesso direto pelo
 * endereço), vai para a tela "pai". `aoVoltar` troca o comportamento (ex.: modos do login).
 */
export function BotaoVoltar({
  aoVoltar,
  className,
}: {
  aoVoltar?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function voltar() {
    if (aoVoltar) return aoVoltar();
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: rotaPai(pathname), replace: true });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("min-h-11 min-w-11 gap-1.5 px-3", className)}
      onClick={voltar}
    >
      <ArrowLeft aria-hidden="true" /> Voltar
    </Button>
  );
}
