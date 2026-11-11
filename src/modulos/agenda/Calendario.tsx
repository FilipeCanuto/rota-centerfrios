import {
  CalendarCheck,
  FileText,
  Flag,
  PhoneCall,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import {
  gradeDoMes,
  somarDias,
  somarMeses,
  tiposDoDia,
  ORDEM_TIPOS,
  paraData,
  type EventoCalendario,
  type TipoEvento,
} from "@/regras";

/** Ícone, texto e cor de cada tipo: a cor nunca vai sozinha (ícone e nome sempre aparecem). */
export const TIPOS_EVENTO: Record<TipoEvento, { rotulo: string; Icone: LucideIcon; cor: string }> =
  {
    feriado: { rotulo: "Feriado ou sem expediente", Icone: Flag, cor: "text-muted-foreground" },
    agendamento: { rotulo: "Agendamento", Icone: CalendarCheck, cor: "text-primary" },
    retorno: { rotulo: "Retorno combinado", Icone: PhoneCall, cor: "text-sucesso" },
    orcamento: { rotulo: "Orçamento a vencer", Icone: FileText, cor: "text-atencao" },
    recompra: { rotulo: "Recompra prevista", Icone: ShoppingCart, cor: "text-perigo" },
  };

export function IconeEvento({
  tipo,
  className = "size-4",
}: {
  tipo: TipoEvento;
  className?: string;
}) {
  const { Icone, cor } = TIPOS_EVENTO[tipo];
  return <Icone className={`${className} ${cor}`} aria-hidden="true" />;
}

export function LegendaCalendario() {
  return (
    <ul aria-label="Legenda do calendário" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {ORDEM_TIPOS.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <IconeEvento tipo={t} /> {TIPOS_EVENTO[t].rotulo}
        </li>
      ))}
    </ul>
  );
}

const SEMANA = [
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
  "domingo",
];
const diaCompleto = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });

function rotuloDoDia(iso: string, hoje: string, eventos: EventoCalendario[]) {
  const partes = [diaCompleto.format(paraData(iso))];
  if (iso === hoje) partes.push("hoje");
  const tipos = tiposDoDia(eventos).map((t) => TIPOS_EVENTO[t].rotulo);
  partes.push(
    eventos.length === 0
      ? "sem eventos"
      : `${eventos.length} ${eventos.length === 1 ? "evento" : "eventos"}: ${tipos.join(", ")}`,
  );
  return partes.join(", ");
}

/** Grade do mês (segunda a domingo), navegável por setas; o dia selecionado é o único com Tab. */
export function CalendarioMes({
  selecionado,
  hoje,
  eventosPorDia,
  aoSelecionar,
}: {
  selecionado: string;
  hoje: string;
  eventosPorDia: Map<string, EventoCalendario[]>;
  aoSelecionar: (iso: string) => void;
}) {
  const dias = gradeDoMes(selecionado);
  const mes = selecionado.slice(0, 7);
  const daTeclado = useRef(false);
  const raiz = useRef<HTMLDivElement>(null);
  const semanas = Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));

  useEffect(() => {
    if (!daTeclado.current) return;
    daTeclado.current = false;
    raiz.current?.querySelector<HTMLButtonElement>(`[data-dia="${selecionado}"]`)?.focus();
  }, [selecionado]);

  function teclar(e: React.KeyboardEvent) {
    const passo: Record<string, string> = {
      ArrowLeft: somarDias(selecionado, -1),
      ArrowRight: somarDias(selecionado, 1),
      ArrowUp: somarDias(selecionado, -7),
      ArrowDown: somarDias(selecionado, 7),
      Home: somarDias(selecionado, -((paraData(selecionado).getDay() + 6) % 7)),
      End: somarDias(selecionado, 6 - ((paraData(selecionado).getDay() + 6) % 7)),
      PageUp: somarMeses(selecionado, -1),
      PageDown: somarMeses(selecionado, 1),
    };
    const alvo = passo[e.key];
    if (!alvo) return;
    e.preventDefault();
    daTeclado.current = true;
    aoSelecionar(alvo);
  }

  const titulo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    paraData(selecionado),
  );

  return (
    // As setas chegam por bolha dos botões das células (que são focáveis); a grade em si não recebe foco.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      ref={raiz}
      role="grid"
      aria-label={`Calendário de ${titulo}. Use as setas para mudar de dia.`}
      onKeyDown={teclar}
      className="cartao overflow-hidden"
    >
      <div
        role="row"
        className="grid grid-cols-7 border-b bg-muted text-center text-sm font-semibold"
      >
        {SEMANA.map((s) => (
          <div key={s} role="columnheader" className="py-2">
            <abbr title={s} className="no-underline">
              {s.slice(0, 3)}
            </abbr>
          </div>
        ))}
      </div>
      {semanas.map((sem) => (
        <div key={sem[0]} role="row" className="grid grid-cols-7">
          {sem.map((iso) => {
            const eventos = eventosPorDia.get(iso) ?? [];
            const feriado = eventos.some((e) => e.tipo === "feriado");
            const ativo = iso === selecionado;
            return (
              <div
                key={iso}
                role="gridcell"
                aria-selected={ativo}
                className="border-b border-r p-0.5 last:border-r-0"
              >
                <button
                  type="button"
                  data-dia={iso}
                  tabIndex={ativo ? 0 : -1}
                  aria-label={rotuloDoDia(iso, hoje, eventos)}
                  aria-current={iso === hoje ? "date" : undefined}
                  onClick={() => aoSelecionar(iso)}
                  className={[
                    "flex min-h-14 w-full flex-col items-center gap-1 rounded-md p-1 text-sm sm:min-h-20",
                    iso.slice(0, 7) === mes ? "" : "text-muted-foreground",
                    feriado ? "bg-muted" : "",
                    iso === hoje ? "bg-primary-suave font-bold" : "",
                    ativo ? "ring-2 ring-primary" : "hover:bg-muted",
                  ].join(" ")}
                >
                  <span className="numeros">{Number(iso.slice(8))}</span>
                  <span className="flex flex-wrap justify-center gap-0.5" aria-hidden="true">
                    {tiposDoDia(eventos).map((t) => (
                      <IconeEvento key={t} tipo={t} className="size-3.5" />
                    ))}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
