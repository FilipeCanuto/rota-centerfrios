import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logo-centerfrios.png.asset.json";
import { INTERVALO_PALCO_MS, type TipoMidia } from "@/regras";

export interface ItemPalco {
  id: string;
  tipo: TipoMidia;
  url?: string | undefined;
  texto_alternativo: string;
}

const consulta = (q: string) => typeof window !== "undefined" && window.matchMedia(q).matches;
const economiaDeDados = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/** Marca a raiz do palco/fundo com `data-pausado` enquanto a aba está oculta (o CSS para as animações). */
export function useAbaOculta() {
  const [oculta, setOculta] = useState(false);
  useEffect(() => {
    const f = () => setOculta(document.hidden);
    f();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  return oculta;
}

/** Palco sem mídia cadastrada: fundo animado da marca. Nunca fica vazio nem quebrado. */
export function PalcoMarca() {
  return (
    <div className="relative grid size-full place-items-center overflow-hidden bg-[var(--polar-noite-900)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="malha absolute -left-1/4 -top-1/4 size-[70%] rounded-full bg-[var(--polar-azul-700)] blur-3xl" />
        <div
          className="malha absolute -bottom-1/4 -right-1/4 size-[65%] rounded-full bg-ouro/40 blur-3xl"
          style={{ animationDelay: "-14s" }}
        />
      </div>
      <div className="subir relative rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <img src={logo.url} alt="CENTERFRIOS" className="h-12 w-auto sm:h-16" />
      </div>
    </div>
  );
}

function Item({
  item,
  saindo,
  tocarVideo,
}: {
  item: ItemPalco;
  saindo: boolean;
  tocarVideo: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (tocarVideo && !saindo) void v.play().catch(() => undefined);
    else v.pause();
  }, [tocarVideo, saindo]);
  const classe = `absolute inset-0 size-full object-cover ${saindo ? "palco-sair" : "palco-entrar"}`;
  if (!item.url) return null;
  if (item.tipo === "video")
    return (
      <video
        ref={video}
        // O primeiro quadro faz o papel de poster (o cadastro não guarda uma imagem à parte).
        src={`${item.url}#t=0.1`}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={item.texto_alternativo}
        className={classe}
      />
    );
  return (
    <img
      src={item.url}
      alt={item.texto_alternativo}
      decoding="async"
      className={`${classe} ${item.tipo === "imagem" && !saindo ? "ken-burns" : ""}`}
    />
  );
}

/**
 * Palco de mídia do login (e a prévia das Configurações, que usa este mesmo componente).
 * Troca a cada 12 s com crossfade; com movimento reduzido começa pausado e vídeo mostra só o quadro.
 */
export function PalcoMidia({ itens }: { itens: ItemPalco[] }) {
  const visiveis = itens.filter((i) => i.url);
  const [atual, setAtual] = useState(0);
  const [anterior, setAnterior] = useState<number | null>(null);
  const [pausado, setPausado] = useState(() => consulta("(prefers-reduced-motion: reduce)"));
  const oculta = useAbaOculta();
  const semVideo = consulta("(prefers-reduced-motion: reduce)") || economiaDeDados();
  const total = visiveis.length;
  const indice = total ? atual % total : 0;

  function ir(i: number) {
    if (i === indice) return;
    setAnterior(indice);
    setAtual(i);
  }
  useEffect(() => {
    if (anterior === null) return;
    const t = setTimeout(() => setAnterior(null), 1400);
    return () => clearTimeout(t);
  }, [anterior]);
  useEffect(() => {
    if (total < 2 || pausado || oculta) return;
    const t = setTimeout(() => ir((indice + 1) % total), INTERVALO_PALCO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, pausado, oculta, indice]);
  useEffect(() => {
    // Aquece a próxima imagem para o crossfade não esperar a rede.
    const prox = visiveis[(indice + 1) % Math.max(total, 1)];
    if (total > 1 && prox?.url && prox.tipo !== "video") new Image().src = prox.url;
  }, [visiveis, indice, total]);

  if (!total) return <PalcoMarca />;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Imagens da CENTERFRIOS"
      data-pausado={oculta}
      className="relative size-full overflow-hidden bg-[var(--polar-noite-900)]"
    >
      <div aria-live={pausado ? "polite" : "off"} className="absolute inset-0">
        {anterior !== null && visiveis[anterior % total] && (
          <Item
            key={visiveis[anterior % total]!.id}
            item={visiveis[anterior % total]!}
            saindo
            tocarVideo={false}
          />
        )}
        <Item
          key={visiveis[indice]!.id}
          item={visiveis[indice]!}
          saindo={false}
          tocarVideo={!semVideo}
        />
      </div>
      {/* Camada escura sutil: dá contraste aos controles sobre qualquer imagem. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent"
      />
      {total > 1 && (
        <div className="absolute bottom-3 left-3 flex items-center rounded-full bg-black/60 text-white">
          <button
            type="button"
            onClick={() => setPausado((p) => !p)}
            aria-pressed={pausado}
            aria-label={pausado ? "Retomar apresentação" : "Pausar apresentação"}
            className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {pausado ? (
              <Play aria-hidden="true" className="size-4" />
            ) : (
              <Pause aria-hidden="true" className="size-4" />
            )}
          </button>
          <div className="flex pr-2">
            {visiveis.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Mostrar imagem ${i + 1} de ${total}`}
                aria-current={i === indice}
                className="group grid size-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span
                  className={`block h-2 rounded-full bg-white transition-all ${i === indice ? "w-5" : "w-2 opacity-60 group-hover:opacity-100"}`}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
