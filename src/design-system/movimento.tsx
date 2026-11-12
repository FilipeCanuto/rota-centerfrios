import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
} from "react";
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

/**
 * Aparelho realmente fraco (até 2 núcleos ou até 1 GB de memória): o CSS encurta o movimento e o
 * contador não conta. Antes o corte era 4 núcleos / 2 GB, que pegava notebooks e celulares comuns.
 */
const leve = () => {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 2 || (n.deviceMemory ?? 8) <= 1;
};
if (typeof document !== "undefined" && leve())
  document.documentElement.setAttribute("data-movimento", "leve");

/**
 * Preferência "Intensidade do movimento" (por aparelho, em localStorage). O CSS lê
 * `data-intensidade` na raiz; prefers-reduced-motion do sistema sempre vence (só fade curto).
 */
export type Intensidade = "suave" | "normal" | "expressivo";
export const INTENSIDADES: { valor: Intensidade; rotulo: string }[] = [
  { valor: "suave", rotulo: "Suave" },
  { valor: "normal", rotulo: "Normal" },
  { valor: "expressivo", rotulo: "Expressivo" },
];
const CHAVE_INTENSIDADE = "rota-movimento";
const ouvintes = new Set<() => void>();
const lerIntensidade = (): Intensidade => {
  try {
    const v = localStorage.getItem(CHAVE_INTENSIDADE);
    return v === "suave" || v === "expressivo" ? v : "normal";
  } catch {
    return "normal";
  }
};
export function definirIntensidade(i: Intensidade) {
  try {
    localStorage.setItem(CHAVE_INTENSIDADE, i);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  document.documentElement.setAttribute("data-intensidade", i);
  ouvintes.forEach((f) => f());
}
export const useIntensidade = () =>
  useSyncExternalStore(
    (f) => (ouvintes.add(f), () => ouvintes.delete(f)),
    lerIntensidade,
    () => "normal" as Intensidade,
  );
/** Script inline no <head>: aplica a preferência antes da hidratação (sem piscar). */
export const scriptMovimentoInicial = `try{var m=localStorage.getItem('${CHAVE_INTENSIDADE}');if(m==='suave'||m==='expressivo')document.documentElement.setAttribute('data-intensidade',m)}catch(e){}`;

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
    // Mesma duração dos gráficos (token CSS), para número e barra chegarem juntos.
    const total =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--duracao-grafico"),
      ) || 900;
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / total);
      setMostrado(t < 1 ? Math.round(de + (valor - de) * (1 - (1 - t) ** 4)) : valor);
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
