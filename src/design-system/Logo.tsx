import { useState } from "react";
import logo from "@/assets/logo-centerfrios.png.asset.json";

/** Logo da marca; se a imagem não carregar (fora do Lovable, rede ruim), mostra o nome em texto. */
export function Logo({ className = "h-8" }: { className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou)
    return (
      <span
        className={`${className} block truncate leading-7 font-display text-base sm:text-lg font-extrabold tracking-tight text-primary`}
      >
        CENTERFRIOS
      </span>
    );
  return (
    <img
      src={logo.url}
      alt="CENTERFRIOS"
      className={`${className} w-auto max-w-full object-contain`}
      onError={() => setFalhou(true)}
      // O erro pode acontecer antes da hidratação: confere ao montar.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setFalhou(true);
      }}
    />
  );
}
