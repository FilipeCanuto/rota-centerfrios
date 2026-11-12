import { useEffect, useState } from "react";
import { Pinguim } from "./Pinguim";

/**
 * Depois do login: check animado e, em seguida, "Bem-vindo", antes de abrir o Início.
 * Curto de propósito (cerca de 2,4 s; bem menos com "reduzir movimento") e anunciado ao leitor de tela.
 */
export function TransicaoEntrada({
  nome,
  aoTerminar,
}: {
  nome: string | null;
  aoTerminar: () => void;
}) {
  const [etapa, setEtapa] = useState<"check" | "boas-vindas">("check");
  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setEtapa("boas-vindas"), reduzido ? 250 : 1100);
    const t2 = setTimeout(aoTerminar, reduzido ? 700 : 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma vez por login
  }, []);
  const primeiroNome = nome?.trim().split(/\s+/)[0];

  return (
    <div className="desvanecer fixed inset-0 z-50 grid place-items-center bg-background px-6">
      <p role="status" className="sr-only">
        Login confirmado. Bem-vindo{primeiroNome ? `, ${primeiroNome}` : ""}.
      </p>
      {etapa === "check" ? (
        <svg
          viewBox="0 0 56 56"
          className="pulsar size-28 text-sucesso"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle className="check-circulo" cx="28" cy="28" r="26" />
          <path className="check-marca" d="M16 29l8 8 16-17" />
        </svg>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center" aria-hidden="true">
          <Pinguim className="subir size-28" expressao="feliz" />
          <p
            className="subir font-display text-3xl font-extrabold"
            style={{ "--atraso": "80ms" } as React.CSSProperties}
          >
            Bem-vindo{primeiroNome ? `, ${primeiroNome}` : ""}!
          </p>
          <p
            className="subir text-muted-foreground"
            style={{ "--atraso": "160ms" } as React.CSSProperties}
          >
            Preparando o seu painel…
          </p>
        </div>
      )}
    </div>
  );
}
