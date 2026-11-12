import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Movimento do Polar em código. Os tokens e utilitários (pressionar, cartao-interativo, cascata,
 * esqueleto) ficam em styles.css; aqui só o que precisa de JavaScript.
 */

const reduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Aplica uma mudança de estado com a View Transitions do navegador: elementos com o mesmo
 * `view-transition-name` antes e depois se transformam um no outro (card que expande, lista que
 * reorganiza). Sem suporte, a mudança é aplicada direto.
 */
export function transicaoDeVisao(atualizar: () => void) {
  if (typeof document === "undefined" || !document.startViewTransition) return atualizar();
  document.startViewTransition(() => flushSync(atualizar));
}

/** Número que conta até o valor. O leitor de tela recebe só o valor final. */
export function Contador({ valor, className }: { valor: number; className?: string }) {
  const [mostrado, setMostrado] = useState(valor);
  useEffect(() => {
    if (reduzido()) return setMostrado(valor);
    const de = mostrado;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 360);
      setMostrado(Math.round(de + (valor - de) * (1 - (1 - t) ** 3)));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parte do número que está na tela
  }, [valor]);
  return (
    <span className={className}>
      <span aria-hidden="true">{mostrado}</span>
      <span className="sr-only">{valor}</span>
    </span>
  );
}
