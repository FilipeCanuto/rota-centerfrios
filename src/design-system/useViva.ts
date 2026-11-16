import { useEffect, useState, type RefObject } from "react";

/** true enquanto o elemento está na tela e a aba visível: pausa animações contínuas fora disso. */
export function useViva(ref: RefObject<HTMLElement | null>) {
  const [naTela, setNaTela] = useState(true);
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setNaTela(!!e?.isIntersecting));
    io.observe(el);
    const aba = () => setVisivel(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", aba);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", aba);
    };
  }, [ref]);
  return naTela && visivel;
}
