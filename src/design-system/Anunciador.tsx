import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

/** Região aria-live="polite" para avisos dinâmicos sem roubar o foco. */
export function ProvedorAnunciador({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const anunciar = useCallback((m: string) => {
    setMsg("");
    setTimeout(() => setMsg(m), 50);
  }, []);
  return (
    <Ctx.Provider value={anunciar}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">
        {msg}
      </div>
    </Ctx.Provider>
  );
}
export const useAnunciar = () => useContext(Ctx);
