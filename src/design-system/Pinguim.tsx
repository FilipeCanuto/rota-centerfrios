import { cn } from "@/lib/utils";
import type { Expressao, VersaoPinguim } from "@/regras";
import { svgBusto } from "./mascote";

/**
 * Pinguim CENTERFRIOS (busto vetorizado, cores da marca). Decorativo: o sentido da expressão sempre
 * vem escrito ao lado. O contorno usa a cor do texto, para a cabeça preta aparecer no tema escuro.
 * Os SVG de corpo inteiro (várias poses) ficam em /mascote, gerados por scripts/gerar-mascote.ts.
 */
export function Pinguim({
  className = "size-16",
  expressao = "neutro",
  versao = "consultor",
}: {
  className?: string;
  expressao?: Expressao;
  versao?: VersaoPinguim;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 [&>svg]:size-full", className)}
      // SVG montado por código do próprio projeto, sem dado de usuário.
      dangerouslySetInnerHTML={{ __html: svgBusto(expressao, versao) }}
    />
  );
}
