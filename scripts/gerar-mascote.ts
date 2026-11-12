// Gera os SVGs do Pinguim em public/mascote a partir de src/design-system/mascote.
// Uso: node scripts/gerar-mascote.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { svgBusto, svgCompleto } from "../src/design-system/mascote/index.ts";

const pasta = "public/mascote";
mkdirSync(pasta, { recursive: true });

const poses = [
  ["frente", "feliz", "Pinguim CENTERFRIOS de frente"],
  ["acenando", "feliz", "Pinguim CENTERFRIOS acenando"],
  ["apontando", "feliz", "Pinguim CENTERFRIOS apontando"],
  ["joinha", "feliz", "Pinguim CENTERFRIOS fazendo joinha"],
  ["bracos-cruzados", "determinado", "Pinguim CENTERFRIOS de braços cruzados"],
  ["pensativo", "atento", "Pinguim CENTERFRIOS pensativo"],
] as const;
for (const [pose, expressao, titulo] of poses)
  writeFileSync(`${pasta}/pinguim-${pose}.svg`, svgCompleto(pose, expressao, titulo));

for (const e of ["neutro", "feliz", "atento", "comemorando", "determinado", "surpreso"] as const)
  writeFileSync(`${pasta}/pinguim-rosto-${e}.svg`, svgBusto(e));

console.log("SVGs gerados em", pasta);
