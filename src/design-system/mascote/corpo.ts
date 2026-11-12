/** Corpo do Pinguim: moletom preto com capuz, calça cáqui e tênis creme (área 320×520). */
const C = {
  moletom: "#1C1D22",
  moletomLuz: "#2A2C33",
  moletomSombra: "#111216",
  cordao: "#C9CCD3",
  calca: "#C8AE7D",
  calcaSombra: "#A88F60",
  tenis: "#EFE7D4",
  sola: "#D6CAAE",
  luva: "#111114",
};

export type Pose = "frente" | "acenando" | "apontando" | "joinha" | "bracos-cruzados" | "pensativo";

const pernas = `<path d="M104 318 L102 424 Q102 434 112 434 L152 434 Q158 434 158 426 L160 330Z" fill="${C.calca}"/>
<path d="M216 318 L218 424 Q218 434 208 434 L168 434 Q162 434 162 426 L160 330Z" fill="${C.calca}"/>
<path d="M150 336 L152 432 M170 336 L168 432" stroke="${C.calcaSombra}" stroke-width="3" fill="none"/>
<path d="M102 416 L158 416 L158 434 L102 434Z M162 416 L218 416 L218 434 L162 434Z" fill="${C.calcaSombra}" opacity=".55"/>
<path d="M94 452 Q92 432 112 430 L152 430 Q162 432 162 446 L162 456 Q162 462 154 462 L100 462 Q94 462 94 452Z" fill="${C.tenis}"/>
<path d="M226 452 Q228 432 208 430 L168 430 Q158 432 158 446 L158 456 Q158 462 166 462 L220 462 Q226 462 226 452Z" fill="${C.tenis}"/>
<path d="M94 454 L162 454 L162 462 L100 462 Q94 462 94 454Z M226 454 L158 454 L158 462 L220 462 Q226 462 226 454Z" fill="${C.sola}"/>`;

const tronco = `<ellipse cx="160" cy="208" rx="82" ry="26" fill="${C.moletomSombra}"/>
<path d="M84 212 C56 232 54 296 64 334 L256 334 C266 296 264 232 236 212 Q160 190 84 212Z" fill="${C.moletom}"/>
<path d="M92 222 C76 244 72 290 76 318" fill="none" stroke="${C.moletomLuz}" stroke-width="6" stroke-linecap="round"/>
<rect x="64" y="316" width="192" height="20" rx="8" fill="${C.moletomSombra}"/>
<path d="M114 274 Q160 264 206 274 L214 316 L106 316Z" fill="${C.moletomLuz}"/>
<path d="M146 212 L144 254 M174 212 L176 254" stroke="${C.cordao}" stroke-width="3" stroke-linecap="round"/>
<circle cx="144" cy="256" r="3" fill="${C.cordao}"/><circle cx="176" cy="256" r="3" fill="${C.cordao}"/>`;

// Contorno escuro + preenchimento + brilho: o braço se destaca do moletom de mesma cor.
const manga = (d: string) =>
  `<path d="${d}" fill="none" stroke="#08080A" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="${C.moletom}" stroke-width="33" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="${C.moletomLuz}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(-5 -5)" opacity=".8"/>`;
const luva = (x: number, y: number, rot: number, tipo: "punho" | "aberta" | "joinha" | "dedo") => {
  const formas = {
    punho: `<rect x="-14" y="-13" width="28" height="26" rx="12"/>`,
    aberta: `<path d="M-14 12 L-14 -6 Q-14 -12 -9 -12 L-9 -22 Q-9 -26 -5 -26 Q-1 -26 -1 -22 L-1 -26 Q-1 -30 3 -30 Q7 -30 7 -26 L7 -22 Q7 -26 11 -26 Q15 -26 15 -22 L15 4 Q15 14 4 16 L-6 16 Q-14 16 -14 12Z M-14 0 L-24 -10 Q-28 -14 -24 -18 Q-20 -20 -16 -16 L-10 -8Z"/>`,
    joinha: `<rect x="-14" y="-10" width="28" height="24" rx="11"/><rect x="-6" y="-30" width="11" height="24" rx="5.5"/>`,
    dedo: `<rect x="-14" y="-12" width="26" height="24" rx="11"/><rect x="6" y="-7" width="26" height="10" rx="5"/>`,
  }[tipo];
  return `<g transform="translate(${x} ${y}) rotate(${rot})" fill="${C.luva}">${formas}</g>`;
};

/** Braços por pose (desenhados por cima do tronco). */
const bracos: Record<Pose, string> = {
  frente: manga("M96 226 C80 256 92 290 122 296") + manga("M224 226 C240 256 228 290 198 296"),
  acenando:
    manga("M96 226 C70 200 62 160 66 128") +
    luva(66, 108, -8, "aberta") +
    manga("M224 226 C240 256 228 290 198 296"),
  apontando:
    manga("M96 226 C80 256 92 290 122 296") +
    manga("M224 226 C252 236 274 240 292 238") +
    luva(300, 238, 0, "dedo"),
  joinha:
    manga("M96 226 C80 256 92 290 122 296") +
    manga("M224 226 C252 262 262 250 262 226") +
    luva(262, 210, 0, "joinha"),
  "bracos-cruzados":
    manga("M96 226 C84 252 110 274 214 262") +
    manga("M224 226 C236 252 210 278 106 268") +
    luva(214, 262, 0, "punho") +
    luva(106, 268, 0, "punho"),
  pensativo:
    manga("M96 226 C80 256 92 290 122 296") +
    manga("M224 226 C252 262 222 268 196 214 L190 186") +
    luva(188, 172, -12, "punho"),
};

/** Corpo completo para a pose; a cabeça entra por cima, entre o tronco e os braços. */
export function corpo(pose: Pose, cabeca: string) {
  return pernas + tronco + cabeca + bracos[pose];
}
