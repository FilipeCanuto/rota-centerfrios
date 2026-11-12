/** Pinguim CENTERFRIOS em vetor: cabeça. Cores sólidas (sem ids), para várias cópias na mesma página. */
export const COR = {
  preto: "#16171B",
  pretoBrilho: "#2E3038",
  rosto: "#F7F3EA",
  rostoSombra: "#E6DFD0",
  iris: "#4F8FCB",
  pupila: "#0E1520",
  bico: "#F2A33A",
  bicoSombra: "#D9832A",
  boca: "#6B1E22",
  lingua: "#E0655B",
  bochecha: "#F4A6A0",
};

export type Expressao = "neutro" | "feliz" | "atento" | "comemorando" | "determinado" | "surpreso";

function olho(x: number, y: number, abertura: number, olhar: number) {
  return `<ellipse cx="${x}" cy="${y}" rx="17" ry="${19 * abertura}" fill="#fff" stroke="${COR.preto}" stroke-width="2.5"/>
<circle cx="${x + olhar}" cy="${y + 2}" r="${11.5 * Math.min(1, abertura + 0.15)}" fill="${COR.iris}"/>
<circle cx="${x + olhar}" cy="${y + 2}" r="5.5" fill="${COR.pupila}"/>
<circle cx="${x + olhar + 4}" cy="${y - 3}" r="3.5" fill="#fff"/>`;
}

function olhos(e: Expressao) {
  const abertura = e === "surpreso" ? 1.15 : e === "determinado" ? 0.8 : 1;
  const base = olho(134, 108, abertura, 2) + olho(186, 108, abertura, -2);
  // Pálpebra superior: semicerrada no determinado, sorridente no feliz.
  const palpebra =
    e === "determinado"
      ? `<path d="M118 100 Q134 96 150 104 L150 92 L118 90Z M202 100 Q186 96 170 104 L170 92 L202 90Z" fill="${COR.preto}"/>`
      : "";
  const sobrancelha = {
    neutro: "M120 86 Q134 80 148 86 M172 86 Q186 80 200 86",
    feliz: "M120 84 Q134 76 148 84 M172 84 Q186 76 200 84",
    atento: "M120 80 Q134 70 148 80 M172 84 Q186 78 200 84",
    comemorando: "M120 80 Q134 70 148 80 M172 80 Q186 70 200 80",
    determinado: "M120 82 Q136 84 150 92 M200 82 Q184 84 170 92",
    surpreso: "M120 76 Q134 64 148 76 M172 76 Q186 64 200 76",
  }[e];
  return `${base}${palpebra}<path d="${sobrancelha}" fill="none" stroke="${COR.preto}" stroke-width="5" stroke-linecap="round"/>`;
}

function bico(e: Expressao) {
  if (e === "surpreso")
    return `<path d="M136 128 Q160 116 184 128 Q172 136 160 137 Q148 136 136 128Z" fill="${COR.bico}"/>
<ellipse cx="160" cy="152" rx="15" ry="18" fill="${COR.bico}"/><ellipse cx="160" cy="153" rx="9" ry="12" fill="${COR.boca}"/>`;
  if (e === "neutro" || e === "determinado" || e === "atento") {
    const canto = e === "determinado" ? "M126 140 Q160 160 194 134" : "M128 138 Q160 158 192 138";
    return `<path d="M124 132 Q160 114 196 132 Q180 146 160 148 Q140 146 124 132Z" fill="${COR.bico}"/>
<path d="${canto} Q160 150 128 138Z" fill="${COR.bicoSombra}"/>
<path d="${canto}" fill="none" stroke="${COR.bicoSombra}" stroke-width="2" stroke-linecap="round"/>`;
  }
  // feliz e comemorando: bico aberto num sorriso largo, como na referência.
  return `<path d="M120 132 Q160 176 200 132 Q160 146 120 132Z" fill="${COR.bico}"/>
<path d="M128 138 Q160 168 192 138 Q160 148 128 138Z" fill="${COR.boca}"/>
<ellipse cx="160" cy="158" rx="13" ry="6" fill="${COR.lingua}"/>
<path d="M118 130 Q160 112 202 130 Q186 142 160 144 Q134 142 118 130Z" fill="${COR.bico}"/>
<path d="M132 126 Q160 118 188 126" fill="none" stroke="#FFD08A" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
}

/** Cabeça completa, centrada em x=160 (topo em y≈14, queixo em y≈200). */
export function cabeca(e: Expressao) {
  return `<g class="cabeca">
<path d="M160 14 C214 14 248 56 248 112 C248 170 212 204 160 204 C108 204 72 170 72 112 C72 56 106 14 160 14Z" fill="${COR.preto}" stroke="currentColor" stroke-opacity=".35" stroke-width="4"/>
<path d="M118 34 C132 24 152 20 168 22" fill="none" stroke="${COR.pretoBrilho}" stroke-width="8" stroke-linecap="round"/>
<path d="M160 90 C150 64 104 60 97 98 C91 134 110 180 160 196 C210 180 229 134 223 98 C216 60 170 64 160 90Z" fill="${COR.rosto}"/>
<path d="M104 140 C112 172 134 188 160 196 C186 188 208 172 216 140 C200 170 180 182 160 186 C140 182 120 170 104 140Z" fill="${COR.rostoSombra}"/>
<ellipse cx="116" cy="140" rx="10" ry="6" fill="${COR.bochecha}" opacity=".45"/>
<ellipse cx="204" cy="140" rx="10" ry="6" fill="${COR.bochecha}" opacity=".45"/>
${olhos(e)}
<g transform="translate(160 136) scale(1.28) translate(-160 -136)">${bico(e)}</g>
</g>`;
}
