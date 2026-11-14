import { useId, useState } from "react";
import { PalcoMidia, type ItemPalco } from "@/modulos/login/PalcoMidia";
import { areaDoPalco, proporcaoDoPalco, rotuloProporcao, TELAS, type Dispositivo } from "@/regras";

const ROTULOS: Record<Dispositivo, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  celular: "Celular",
};

/**
 * Prévia do palco do login por aparelho, na proporção real calculada de cada um, com o guia da
 * área segura: no desktop, a faixa que continua visível em tablet e celular; nos outros, a margem
 * livre dos controles do carrossel.
 */
export function PreviaPalco({ itens }: { itens: ItemPalco[] }) {
  const nome = useId();
  const [dispositivo, setDispositivo] = useState<Dispositivo>("desktop");
  const [guia, setGuia] = useState(true);
  const { largura, altura } = TELAS[dispositivo];
  const area = areaDoPalco(largura, altura);
  const proporcao = proporcaoDoPalco(dispositivo);
  // Altura (fração do desktop) da faixa que o tablet e o celular, mais largos, ainda mostram.
  const faixa = proporcao / Math.max(proporcaoDoPalco("tablet"), proporcaoDoPalco("celular"));

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-1">
        <legend className="sr-only">Aparelho da prévia</legend>
        {(Object.keys(ROTULOS) as Dispositivo[]).map((d) => (
          <label
            key={d}
            className="flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary-suave has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input
              type="radio"
              name={nome}
              className="sr-only"
              checked={dispositivo === d}
              onChange={() => setDispositivo(d)}
            />
            {ROTULOS[d]}
          </label>
        ))}
      </fieldset>
      <div
        className="relative mx-auto w-full overflow-hidden rounded-2xl border"
        style={{ aspectRatio: String(proporcao), maxWidth: proporcao < 1 ? "20rem" : undefined }}
        data-testid="previa-palco"
      >
        <PalcoMidia itens={itens} />
        {guia && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-dashed border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
            style={
              dispositivo === "desktop"
                ? {
                    left: 0,
                    right: 0,
                    top: `${((1 - faixa) / 2) * 100}%`,
                    height: `${faixa * 100}%`,
                  }
                : { inset: "8%" }
            }
          />
        )}
      </div>
      <p className="text-sm" data-testid="previa-proporcao">
        <strong>Proporção real do palco no {ROTULOS[dispositivo].toLowerCase()}:</strong>{" "}
        {rotuloProporcao(proporcao)} ({area.largura} × {area.altura} px, em uma tela de {largura} ×{" "}
        {altura}).
      </p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={guia}
          onChange={(e) => setGuia(e.target.checked)}
        />
        Mostrar guia de área segura
      </label>
      {guia && (
        <p className="text-sm text-muted-foreground">
          {dispositivo === "desktop"
            ? "A faixa tracejada é o que continua visível no tablet e no celular: deixe lá o assunto principal."
            : "A margem tracejada fica livre dos controles do carrossel e de cortes nas bordas."}
        </p>
      )}
    </div>
  );
}
