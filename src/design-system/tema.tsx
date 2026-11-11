import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Tema = "claro" | "escuro" | "auto";
const CHAVE = "rota-tema";

const Ctx = createContext<{ tema: Tema; definirTema: (t: Tema, salvar?: boolean) => void }>({
  tema: "auto",
  definirTema: () => {},
});

function aplicar(t: Tema) {
  const escuro =
    t === "escuro" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
}

export function ProvedorTema({
  children,
  aoMudar,
}: {
  children: ReactNode;
  aoMudar?: (t: Tema) => void;
}) {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    const salvo = (localStorage.getItem(CHAVE) as Tema | null) ?? "auto";
    setTema(salvo);
  }, []);

  useEffect(() => {
    aplicar(tema);
    if (tema !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => aplicar("auto");
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [tema]);

  const definirTema = useCallback(
    /** `salvar = false` aplica sem gravar no cadastro (ex.: tema vindo do próprio cadastro). */
    (t: Tema, salvar = true) => {
      localStorage.setItem(CHAVE, t);
      setTema(t);
      if (salvar) aoMudar?.(t);
    },
    [aoMudar],
  );

  return <Ctx.Provider value={{ tema, definirTema }}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);

/** Script inline para aplicar o tema antes da hidratação (evita piscar). */
export const scriptTemaInicial = `try{var t=localStorage.getItem('${CHAVE}')||'auto';if(t==='escuro'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
