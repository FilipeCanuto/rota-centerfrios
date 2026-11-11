import type { Expressao, VersaoPinguim } from "@/regras";

const TRACO = { stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" } as const;
const OURO = { stroke: "var(--cor-destaque)", strokeWidth: 2.4, strokeLinecap: "round" } as const;

function Olhos({ expressao }: { expressao: Expressao }) {
  switch (expressao) {
    case "feliz":
    case "comemorando":
      return (
        <>
          <path d="M26.5 23a2.2 2.2 0 0 1 4.4 0" {...TRACO} strokeWidth={1.8} />
          <path d="M33.1 23a2.2 2.2 0 0 1 4.4 0" {...TRACO} strokeWidth={1.8} />
        </>
      );
    case "atento":
      return (
        <>
          <circle cx="28.5" cy="22" r="1.9" fill="currentColor" />
          <circle cx="35.5" cy="22" r="1.9" fill="currentColor" />
          <path d="M25.8 18.5 30.5 17.5M38.2 18.5 33.5 17.5" {...TRACO} strokeWidth={1.5} />
        </>
      );
    default:
      return (
        <>
          <circle cx="28.5" cy="22" r="1.4" fill="currentColor" />
          <circle cx="35.5" cy="22" r="1.4" fill="currentColor" />
        </>
      );
  }
}

/** Acessório da versão, desenhado acima da cabeça. O consultor não usa nenhum. */
function Acessorio({ versao }: { versao: VersaoPinguim }) {
  if (versao === "panificador")
    return (
      <path
        d="M24 9c-3-1-3-6 1-6 1-3 6-3 7-1 1-2 6-2 7 1 4 0 4 5 1 6v3H24Z"
        {...TRACO}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    );
  if (versao === "acougueiro")
    return (
      <path
        d="M22 11c1-5 5-7 10-7s9 2 10 7M20 11h24"
        {...TRACO}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    );
  if (versao === "pizzaiolo")
    return (
      <path
        d="M24 10c0-4 3-6 8-6s8 2 8 6m-18 0h20M30 6.5l1 1M34 7l1 1"
        {...TRACO}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    );
  return null;
}

/**
 * Pinguim estático em SVG (traço marinho com detalhe ouro), com quatro expressões e quatro versões.
 * Decorativo: o sentido da expressão sempre vem escrito na mensagem ao lado.
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
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false" fill="none">
      <path
        d="M32 6c-9 0-15 7-15 17v12c0 9 5 17 6 21h18c1-4 6-12 6-21V23C47 13 41 6 32 6Z M25 24c0-4 3-7 7-7s7 3 7 7v14c0 6-3 11-7 11s-7-5-7-11V24Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Olhos expressao={expressao} />
      <path d="M29 26.5 32 29l3-2.5" {...OURO} strokeLinejoin="round" />
      <path d="M24 57h7M33 57h7" {...OURO} />
      {expressao === "comemorando" && (
        <path d="M9 14v6M6 17h6M55 10v6M52 13h6" {...OURO} strokeWidth={2} />
      )}
      <Acessorio versao={versao} />
    </svg>
  );
}
