import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { flushSync } from "react-dom";

/**
 * Movimento do Polar em código. Os tokens e utilitários (pressionar, cartao-interativo, cascata,
 * esqueleto) ficam em styles.css; aqui só o que precisa de JavaScript.
 */

const reduzido = () =>
  typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Aplica uma mudança de estado com a View Transitions do navegador: elementos com o mesmo
 * `view-transition-name` antes e depois se transformam um no outro (card que expande, lista que
 * reorganiza). Sem suporte, a mudança é aplicada direto.
 */
export function transicaoDeVisao(atualizar: () => void) {
  if (typeof document === "undefined" || !document.startViewTransition) return atualizar();
  document.startViewTransition(() => flushSync(atualizar));
}

/** Aparelho fraco (poucos núcleos ou pouca memória): o CSS encurta o movimento e o contador não conta. */
const leve = () => {
  const n = navigator as Navigator & { deviceMemory?: number };
  return n.hardwareConcurrency <= 4 || (n.deviceMemory ?? 8) <= 2;
};
if (typeof document !== "undefined" && leve())
  document.documentElement.setAttribute("data-movimento", "leve");

/**
 * Card que expande para o detalhe em outra tela (e volta): o card recebe `{...expansao(id)}`, o
 * link dentro dele `onClick={abrirExpansao(id)}` e o detalhe `style={DETALHE_EXPANSAO}`. O nome de
 * transição fica só no card clicado, então listas longas não pagam por isso.
 */
let expandido: string | null = null;
export const DETALHE_EXPANSAO = { viewTransitionName: "expansao" } as CSSProperties;
export const expansao = (id: string) => ({
  "data-expansao": "",
  style: expandido === id ? DETALHE_EXPANSAO : undefined,
});
export const abrirExpansao = (id: string) => (e: MouseEvent<HTMLElement>) => {
  document
    .querySelectorAll<HTMLElement>("[data-expansao]")
    .forEach((el) => (el.style.viewTransitionName = ""));
  expandido = id;
  const card = e.currentTarget.closest<HTMLElement>("[data-expansao]");
  if (card) card.style.viewTransitionName = "expansao";
};

/**
 * Número que conta de zero até o valor. O texto final ocupa o lugar desde o início (sem deslocar
 * o layout) e é o único que o leitor de tela recebe.
 */
export function Contador({
  valor,
  formatar = String,
  className,
}: {
  valor: number;
  formatar?: (n: number) => string;
  className?: string;
}) {
  const [mostrado, setMostrado] = useState(() => (reduzido() || leve() ? valor : 0));
  useEffect(() => {
    if (reduzido() || leve()) return setMostrado(valor);
    const de = mostrado;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 360);
      setMostrado(t < 1 ? Math.round(de + (valor - de) * (1 - (1 - t) ** 3)) : valor);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parte do número que está na tela
  }, [valor]);
  const contando = mostrado !== valor;
  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className={contando ? "opacity-0" : undefined}>{formatar(valor)}</span>
      {contando && (
        <span aria-hidden="true" className="absolute inset-0 whitespace-nowrap">
          {formatar(mostrado)}
        </span>
      )}
    </span>
  );
}
