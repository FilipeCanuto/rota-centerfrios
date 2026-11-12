import { useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mascote } from "@/design-system/Mascote";
import { useIsMobile } from "@/hooks/use-mobile";
import { cantoMaisProximo, CANTOS, cantoValido, ESTADOS_MASCOTE, type Fala } from "@/regras";
import type { VisaoMascote } from "./MascoteProvider";
import { ROTULOS } from "./mensagens";

const CAMPO = "input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable=true]";
const MODAL = '[role="dialog"],[role="alertdialog"]';
/** Movimento mínimo (px) para o toque virar arrasto em vez de abrir o menu. */
const FOLGA_ARRASTO = 6;

/** Encolhe sozinho enquanto a pessoa digita ou há um modal aberto, para não cobrir o que importa. */
function useEncolher() {
  const [encolhido, setEncolhido] = useState(false);
  useEffect(() => {
    const avaliar = () =>
      setEncolhido(
        !!document.activeElement?.matches(CAMPO) || document.querySelector(MODAL) !== null,
      );
    const adiado = () => setTimeout(avaliar, 0);
    avaliar(); // a página pode abrir já com um campo em foco
    document.addEventListener("focusin", avaliar);
    document.addEventListener("focusout", adiado);
    // Modais do sistema entram como filhos diretos do body: observar só esse nível é barato.
    const obs = new MutationObserver(avaliar);
    obs.observe(document.body, { childList: true });
    return () => {
      document.removeEventListener("focusin", avaliar);
      document.removeEventListener("focusout", adiado);
      obs.disconnect();
    };
  }, []);
  return encolhido;
}

/** Movimento contínuo só em aparelho que aguenta e com a aba à vista. */
function useAnimado() {
  const [animado, setAnimado] = useState(false);
  useEffect(() => {
    const n = navigator as Navigator & { deviceMemory?: number };
    const fraco = (n.hardwareConcurrency ?? 8) <= 2 || (n.deviceMemory ?? 8) <= 2;
    setAnimado(!fraco && !matchMedia("(prefers-reduced-motion: reduce)").matches);
    const aoMudar = () =>
      document.documentElement.toggleAttribute("data-aba-oculta", document.hidden);
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);
  return animado;
}

export function MascoteFlutuante(v: VisaoMascote) {
  const celular = useIsMobile();
  const encolhido = useEncolher();
  const animado = useAnimado();
  const [menu, setMenu] = useState(false);
  const [arrasto, setArrasto] = useState<{ x: number; y: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; y: number; rect: DOMRect; moveu: boolean } | null>(null);
  const rotuloEstado = ESTADOS_MASCOTE[v.estado].rotulo;
  const minimizado = v.prefs.minimizado || encolhido;
  // Saída suave: o balão fica mais um instante na tela, já marcado como "saindo".
  const [mostrada, setMostrada] = useState<Fala | null>(v.fala);
  useEffect(() => {
    if (v.fala) return setMostrada(v.fala);
    const t = setTimeout(() => setMostrada(null), 200);
    return () => clearTimeout(t);
  }, [v.fala]);

  function aoApertar(e: React.PointerEvent) {
    e.preventDefault(); // o menu abre no clique (se não houve arrasto), não ao apertar
    if (e.button !== 0 || !caixa.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = {
      x: e.clientX,
      y: e.clientY,
      rect: caixa.current.getBoundingClientRect(),
      moveu: false,
    };
  }
  function aoMover(e: React.PointerEvent) {
    const i = inicio.current;
    if (!i) return;
    const dx = e.clientX - i.x;
    const dy = e.clientY - i.y;
    if (!i.moveu && Math.hypot(dx, dy) < FOLGA_ARRASTO) return;
    i.moveu = true;
    // Nunca sai da tela: o deslocamento é limitado pelas bordas da janela.
    setArrasto({
      x: Math.min(innerWidth - i.rect.right, Math.max(-i.rect.left, dx)),
      y: Math.min(innerHeight - i.rect.bottom, Math.max(-i.rect.top, dy)),
    });
  }
  function aoSoltar() {
    const i = inicio.current;
    inicio.current = null;
    if (!i?.moveu) return setMenu((aberto) => !aberto);
    const x = i.rect.left + i.rect.width / 2 + (arrasto?.x ?? 0);
    const y = i.rect.top + i.rect.height / 2 + (arrasto?.y ?? 0);
    solto.current = caixa.current?.getBoundingClientRect() ?? null;
    setArrasto(null);
    v.definirPrefs({ canto: cantoMaisProximo(x, y, innerWidth, innerHeight) });
  }
  // Encaixe suave: parte de onde foi solto e desliza até o canto (só transform).
  const solto = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    const de = solto.current;
    const el = caixa.current;
    solto.current = null;
    if (!de || !el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const para = el.getBoundingClientRect();
    const estilo = getComputedStyle(el);
    el.animate(
      [
        { transform: `translate(${de.left - para.left}px, ${de.top - para.top}px)` },
        { transform: "none" },
      ],
      {
        duration: parseFloat(estilo.getPropertyValue("--duracao-lenta")) || 0,
        easing: estilo.getPropertyValue("--curva-enfase").trim() || "ease-out",
      },
    );
  }, [arrasto, v.prefs.canto]);

  return (
    <div
      ref={caixa}
      className="mascote-flutuante"
      data-canto={v.prefs.canto}
      data-arrastando={arrasto ? "" : undefined}
      style={arrasto ? { transform: `translate(${arrasto.x}px, ${arrasto.y}px)` } : undefined}
    >
      {minimizado ? (
        <button
          type="button"
          className="mascote-bolinha pressionar"
          aria-label={ROTULOS.restaurar(v.apelido)}
          // Encolhido por causa de um campo ou modal: volta sozinho, o toque não muda a preferência.
          onClick={() => v.definirPrefs({ minimizado: false })}
        >
          <Mascote estado={v.estado} tamanho={40} versao={v.versao} />
        </button>
      ) : (
        <>
          {mostrada && <Balao key={mostrada.id} fala={mostrada} v={v} saindo={!v.fala} />}
          <DropdownMenu open={menu} onOpenChange={setMenu}>
            <DropdownMenuTrigger
              asChild
              // No Trigger (e não no botão) o Radix respeita o preventDefault e não abre ao apertar.
              onPointerDown={aoApertar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={() => {
                inicio.current = null;
                setArrasto(null);
              }}
            >
              <button
                type="button"
                className="mascote-botao"
                aria-label={`${ROTULOS.menu(v.apelido)}. ${rotuloEstado}`}
              >
                <Mascote
                  estado={v.estado}
                  tamanho={celular ? 64 : 120}
                  versao={v.versao}
                  animado={animado && !arrasto}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>{ROTULOS.moverPara}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={v.prefs.canto}
                onValueChange={(c) => v.definirPrefs({ canto: cantoValido(c) })}
              >
                {CANTOS.map((c) => (
                  <DropdownMenuRadioItem key={c.valor} value={c.valor} className="min-h-11">
                    {c.rotulo}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => v.definirPrefs({ minimizado: true })}
              >
                {ROTULOS.minimizar}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => {
                  v.fechar();
                  v.definirPrefs({ baloesOcultos: !v.prefs.baloesOcultos });
                }}
              >
                {v.prefs.baloesOcultos ? ROTULOS.mostrarBaloes : ROTULOS.ocultarBaloes}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                onSelect={() => v.definirPrefs({ somMudo: !v.prefs.somMudo })}
              >
                {v.prefs.somMudo ? ROTULOS.ativarSons : ROTULOS.silenciar}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

function Balao({ fala, v, saindo }: { fala: Fala; v: VisaoMascote; saindo: boolean }) {
  const router = useRouter();
  const { fechar, pausar } = v;
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      pausar(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- um balão por fala (key)
  }, []);
  const urgente = fala.prioridade === "urgente";
  return (
    <div
      className="mascote-balao"
      data-saindo={saindo ? "" : undefined}
      // Urgente interrompe o leitor de tela; as demais falas saem pelo anunciador educado.
      role={urgente ? "alert" : "group"}
      aria-label={urgente ? undefined : `Fala de ${v.apelido}`}
      onPointerEnter={() => pausar(true)}
      onPointerLeave={() => pausar(false)}
      onFocus={() => pausar(true)}
      onBlur={() => pausar(false)}
    >
      <p className="text-sm font-medium leading-snug">{fala.texto}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {fala.acao ? (
          <Button
            size="sm"
            className="min-h-11"
            onClick={() => {
              const link = fala.acao!.link;
              fechar();
              router.history.push(link);
            }}
          >
            {fala.acao.rotulo}
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label={ROTULOS.fechar}
          onClick={fechar}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
