import { cabeca, type Expressao } from "./cabeca.ts";
import { corpo, type Pose } from "./corpo.ts";

export type { Expressao, Pose };
export type Versao = "consultor" | "panificador" | "acougueiro" | "pizzaiolo";

const BRANCO = "#FFFFFF";
const TRACO = "#D9D4C7";

/** Chapéus das versões, acima da cabeça. O consultor usa só o moletom. */
const chapeu: Record<Versao, string> = {
  consultor: "",
  panificador: `<path d="M104 52 C84 40 92 6 122 14 C128 -8 162 -14 172 6 C190 -10 228 4 218 34 C236 42 230 62 216 62 L104 62Z" fill="${BRANCO}" stroke="${TRACO}" stroke-width="3"/><rect x="102" y="50" width="116" height="20" rx="6" fill="${BRANCO}" stroke="${TRACO}" stroke-width="3"/>`,
  acougueiro: `<path d="M86 64 C90 26 120 8 160 8 C200 8 230 26 234 64Z" fill="${BRANCO}" stroke="${TRACO}" stroke-width="3"/><path d="M84 60 L236 60 L240 72 L80 72Z" fill="#B8322E"/>`,
  pizzaiolo: `<path d="M98 56 C92 26 126 2 160 4 C194 2 228 26 222 56Z" fill="${BRANCO}" stroke="${TRACO}" stroke-width="3"/><path d="M96 52 L224 52 L224 64 L96 64Z" fill="#2E8B57"/><path d="M140 52 L180 52 L180 64 L140 64Z" fill="#C8372D"/>`,
};

const brilhos = `<g fill="#F2C230"><path d="M70 40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4Z"/><path d="M248 24 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z"/></g>`;

/** Pinguim de corpo inteiro numa pose. */
export function svgCompleto(
  pose: Pose,
  expressao: Expressao = "feliz",
  titulo = "Pinguim CENTERFRIOS",
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 0 320 480" role="img" aria-label="${titulo}"><title>${titulo}</title>${corpo(pose, cabeca(expressao))}</svg>`;
}

/** Busto (cabeça e gola do moletom), para usar pequeno no sistema. Sem título: decorativo. */
export function svgBusto(expressao: Expressao = "feliz", versao: Versao = "consultor") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="56 -20 208 256" aria-hidden="true" focusable="false">
<path d="M78 236 C80 214 112 198 160 198 C208 198 240 214 242 236Z" fill="#1C1D22"/>
<path d="M146 204 L145 230 M174 204 L175 230" stroke="#C9CCD3" stroke-width="3" stroke-linecap="round"/>
${cabeca(expressao)}${chapeu[versao]}${expressao === "comemorando" ? brilhos : ""}</svg>`;
}
