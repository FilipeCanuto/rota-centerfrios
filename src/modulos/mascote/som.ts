import { integracoes } from "@/integracoes";

/** Voz do mascote: desligada por decisão do produto. O código fica pronto para ligar depois. */
export const VOZ_ATIVA = false;

type Efeito = "conquista" | "alerta" | "erro";
/** Notas de cada efeito: [frequência em Hz, início em s, duração em s]. */
const NOTAS: Record<Efeito, [number, number, number][]> = {
  conquista: [
    [660, 0, 0.12],
    [880, 0.12, 0.2],
  ],
  alerta: [[520, 0, 0.16]],
  erro: [
    [300, 0, 0.14],
    [220, 0.14, 0.2],
  ],
};

let contexto: AudioContext | null = null;
let interagiu = false;
// O navegador só libera áudio depois de um toque ou tecla da pessoa.
if (typeof window !== "undefined") {
  const liberar = () => (interagiu = true);
  window.addEventListener("pointerdown", liberar, { once: true, passive: true });
  window.addEventListener("keydown", liberar, { once: true, passive: true });
}

/** Efeito curto via WebAudio. Nunca lança: sem áudio, o mascote só fica calado. */
export function tocar(efeito: Efeito) {
  try {
    if (!interagiu || document.hidden) return;
    contexto ??= new AudioContext();
    const ctx = contexto;
    for (const [freq, inicio, duracao] of NOTAS[efeito]) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      const t = ctx.currentTime + inicio;
      osc.type = "sine";
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t);
      ganho.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duracao);
    }
  } catch {
    /* sem áudio neste aparelho */
  }
}

export function falarEmVoz(texto: string) {
  if (!VOZ_ATIVA) return;
  try {
    if (integracoes.voz.disponivel()) integracoes.voz.falar(texto);
  } catch {
    /* sem voz neste aparelho */
  }
}
