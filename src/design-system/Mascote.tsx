import { cn } from "@/lib/utils";
import { normalizarEstado, type VersaoPinguim } from "@/regras";

export type TamanhoMascote = 40 | 64 | 120 | 160;

/**
 * Mascote da CENTERFRIOS. Só desenha: recebe o estado e o tamanho, nada de regra de negócio.
 * Decorativo (aria-hidden): o sentido do estado sempre vem em texto ao lado ou no balão.
 * Até 64 px mostra só o rosto inteiro (o corpo ficaria ilegível); acima disso, o corpo inteiro.
 * A arte fica em MascoteSprite, montado uma vez na raiz.
 */
export function Mascote({
  estado,
  tamanho = 64,
  versao = "consultor",
  animado = false,
  className,
}: {
  /** Um dos estados de ESTADOS_MASCOTE; qualquer outro valor vira "neutro". */
  estado?: string;
  tamanho?: TamanhoMascote;
  versao?: VersaoPinguim;
  /** Liga o movimento contínuo (respirar, piscar). Desligado em listas e ícones. */
  animado?: boolean;
  className?: string;
}) {
  const busto = tamanho <= 64;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={tamanho}
      height={tamanho}
      // Busto = só a cabeça (x 28–172, y 12–138) com folga para o contorno; com chapéu, sobe o quadro.
      viewBox={
        !busto ? "-10 0 220 220" : versao === "consultor" ? "22 -3 156 156" : "14 -20 172 172"
      }
      data-estado={normalizarEstado(estado)}
      data-animado={animado || undefined}
      className={cn("mascote shrink-0", className)}
    >
      <use href="#mascote" width="200" height="220" />
      <use href="#mascote-palpebras" width="200" height="220" className="m-piscar" />
      {versao !== "consultor" && (
        <use href={`#mascote-chapeu-${versao}`} width="200" height="220" />
      )}
    </svg>
  );
}
