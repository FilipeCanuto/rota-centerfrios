import { useAbaOculta } from "./PalcoMidia";

const luz = (cor: string, forca: number) =>
  `radial-gradient(closest-side, color-mix(in oklab, ${cor} ${forca}%, transparent), transparent)`;

/** Malha de luz lenta atrás do formulário: gradientes radiais nos tons do Polar, só transform/opacity. */
export function MalhaLuz() {
  const oculta = useAbaOculta();
  return (
    <div
      aria-hidden="true"
      data-pausado={oculta}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        className="malha absolute -right-32 -top-32 size-[34rem] rounded-full"
        style={{ background: luz("var(--polar-azul-700)", 22) }}
      />
      <div
        className="malha absolute -bottom-40 -left-24 size-[32rem] rounded-full"
        style={{ background: luz("var(--polar-azul-300)", 22), animationDelay: "-9s" }}
      />
      <div
        className="malha absolute left-1/4 top-1/2 size-[22rem] rounded-full"
        style={{ background: luz("var(--ouro)", 14), animationDelay: "-18s" }}
      />
    </div>
  );
}
