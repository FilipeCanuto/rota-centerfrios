import { Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ESCALA_BARRA, type calcularRitmo } from "@/regras";
import { formatarMoeda } from "./formatar";
import { Contador } from "./movimento";
import { SeloStatus } from "./SeloStatus";
import { useViva } from "./useViva";

type Ritmo = ReturnType<typeof calcularRitmo>;
const pos = (v: number) => Math.max(0, Math.min(v, ESCALA_BARRA)) / ESCALA_BARRA;
const pctTxt = (v: number) => `${Math.round(v * 100)}%`;
const mil = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : formatarMoeda(v);

const STATUS = {
  batida: { tom: "conquista", texto: "Meta batida" },
  no_ritmo: { tom: "sucesso", texto: "No ritmo" },
  abaixo: { tom: "atencao", texto: "Abaixo do ritmo" },
} as const;

/** Barra "Meta do mês" (0 a 125%): faturado, projeção listrada, ritmo de hoje e marca da meta. */
export function BarraMeta({
  faturado,
  meta,
  ritmo,
  rotulo = "Meta do mês",
}: {
  faturado: number;
  meta: number;
  ritmo: Ritmo;
  /** Nome que distingue várias barras na mesma tela (ex.: "Meta do mês de Ana"). */
  rotulo?: string;
}) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const viva = useViva(raiz);
  const [tabela, setTabela] = useState(false);
  // Entra de 0 só na montagem; depois anima do valor anterior ao novo (transição CSS).
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const q = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(q);
  }, []);
  const r = ritmo;
  const batida = r.status === "batida";
  const fFat = pronto ? pos(r.atingido) : 0;
  const fProj = pos(r.projecaoPct);
  const s = STATUS[r.status];
  const descricao =
    `${rotulo}: ${pctTxt(r.atingido)} atingido, ${formatarMoeda(faturado)} de ${formatarMoeda(meta)}. ` +
    (r.concluido ? "Mês concluído. " : `Onde deveria estar hoje: ${pctTxt(r.ritmo)}. `) +
    `Projeção do mês: ${formatarMoeda(r.projecao)} (${pctTxt(r.projecaoPct)} da meta). Status: ${s.texto}.`;

  const linhas: [string, string][] = [
    ["Meta do mês", formatarMoeda(meta)],
    ["Faturado", `${formatarMoeda(faturado)} (${pctTxt(r.atingido)})`],
    [
      batida ? "Acima da meta" : "Falta para a meta",
      formatarMoeda(batida ? faturado - meta : r.falta),
    ],
    ...(r.concluido
      ? []
      : ([
          ["Onde deveria estar hoje", pctTxt(r.ritmo)],
          ["Ritmo necessário por dia útil", formatarMoeda(r.ritmoNecessario)],
          ["Dias úteis restantes", String(r.restantes)],
        ] as [string, string][])),
    [
      r.concluido ? "Fechamento do mês" : "Projeção do mês",
      `${formatarMoeda(r.projecao)} (${pctTxt(r.projecaoPct)})`,
    ],
  ];

  return (
    <div ref={raiz} className="barra-meta flex flex-col gap-5" data-viva={viva}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="flex items-baseline gap-3">
          <span
            className={`numeros font-display text-4xl font-extrabold ${batida ? "text-ouro-texto" : ""}`}
          >
            <Contador valor={Math.round(r.atingido * 100)} formatar={(n) => `${n}%`} />
          </span>
          <span className="numeros text-muted-foreground">
            <Contador valor={faturado} formatar={formatarMoeda} /> de {formatarMoeda(meta)}
          </span>
        </p>
        <span className="inline-flex items-center gap-1">
          <SeloStatus tom={s.tom}>{s.texto}</SeloStatus>
          {batida && (
            <Sparkles className="barra-meta__festa size-5 text-ouro-texto" aria-hidden="true" />
          )}
        </span>
      </div>

      <TrilhoMeta
        descricao={descricao}
        meta={meta}
        fFat={fFat}
        fProj={fProj}
        ritmo={r.concluido ? null : r.ritmo}
        batida={batida}
      />

      <Legenda />
      <Indicadores r={r} faturado={faturado} meta={meta} />

      <div>
        <Button
          variant="outline"
          className="min-h-11"
          aria-expanded={tabela}
          aria-controls={`${id}-tab`}
          onClick={() => setTabela((v) => !v)}
        >
          {tabela ? "Ocultar tabela" : "Ver tabela"}
          {rotulo !== "Meta do mês" && <span className="sr-only"> ({rotulo})</span>}
        </Button>
        <div id={`${id}-tab`}>
          {tabela && (
            <div
              // Região rolável precisa de foco pelo teclado (axe scrollable-region-focusable).
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              role="region"
              aria-label={`${rotulo} em tabela`}
              className="barra-meta__tabela mt-3 overflow-x-auto rounded-lg border focus-visible:outline-2 focus-visible:outline-ring"
            >
              <table className="w-full min-w-[18rem] text-sm">
                <caption className="sr-only">{rotulo} em tabela</caption>
                <tbody>
                  {linhas.map(([k, v]) => (
                    <tr key={k} className="border-b last:border-0">
                      <th scope="row" className="p-2 text-left font-medium">
                        {k}
                      </th>
                      <td className="numeros p-2 text-right">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const LISTRAS =
  "repeating-linear-gradient(135deg, var(--primary) 0 9.9px, transparent 9.9px 19.8px)";

/** Posição que nunca vaza o recipiente: o rótulo desliza para dentro perto das bordas. */
const rotuloEm = (f: number) => ({ left: `${f * 100}%`, transform: `translateX(-${f * 100}%)` });

function TrilhoMeta(p: {
  descricao: string;
  meta: number;
  fFat: number;
  fProj: number;
  ritmo: number | null;
  batida: boolean;
}) {
  const fMeta = pos(1);
  const fRitmo = p.ritmo === null ? null : pos(p.ritmo);
  return (
    <div role="img" aria-label={p.descricao} className="relative pb-11 pt-7">
      <span
        className="absolute top-0 whitespace-nowrap text-xs font-semibold"
        style={rotuloEm(fMeta)}
      >
        Meta · {mil(p.meta)}
      </span>
      <div className="relative h-5 overflow-hidden rounded-full bg-muted [box-shadow:inset_0_1px_2px_color-mix(in_oklab,var(--cor-sombra)_22%,transparent)]">
        <div
          className="absolute inset-y-0 overflow-hidden opacity-60 transition-opacity duration-700"
          style={{ left: `${p.fFat * 100}%`, width: `${Math.max(0, p.fProj - p.fFat) * 100}%` }}
        >
          <div
            className="barra-meta__listras absolute inset-y-0 -left-7 right-0"
            style={{ backgroundImage: LISTRAS }}
          />
        </div>
        <div
          className={`barra-meta__mov absolute inset-0 origin-left ${p.batida ? "bg-ouro" : "bg-primary"}`}
          style={{ transform: `scaleX(${p.fFat})` }}
        />
        <div
          className="barra-meta__mov absolute inset-0 overflow-hidden"
          style={{ transform: `translateX(${(p.fFat - 1) * 100}%)` }}
        >
          <div className="barra-meta__reflexo absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          <div className="barra-meta__respira absolute inset-y-0.5 right-0.5 w-4 rounded-full bg-white/70 blur-[3px]" />
        </div>
      </div>
      <span
        className="absolute top-5 bottom-9 w-0.5 -translate-x-1/2 bg-foreground"
        style={{ left: `${fMeta * 100}%` }}
      />
      {fRitmo !== null && (
        <>
          <span
            className="absolute top-6 h-7 -translate-x-1/2 border-l-2 border-dashed border-foreground/70"
            style={{ left: `${fRitmo * 100}%` }}
          />
          <span
            className="absolute bottom-0 whitespace-nowrap text-xs font-semibold"
            style={rotuloEm(fRitmo)}
          >
            Ritmo de hoje · {pctTxt(p.ritmo!)}
          </span>
        </>
      )}
      {[0.25, 0.5, 0.75].map((m) => (
        <span
          key={m}
          className="numeros absolute top-[3.25rem] -translate-x-1/2 text-xs text-muted-foreground"
          style={{ left: `${pos(m) * 100}%` }}
        >
          {pctTxt(m)}
        </span>
      ))}
    </div>
  );
}

function Legenda() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legenda">
      <li className="flex items-center gap-2">
        <span className="h-3 w-5 rounded-sm bg-primary" aria-hidden="true" /> Faturado
      </li>
      <li className="flex items-center gap-2">
        <span
          className="h-3 w-5 rounded-sm opacity-60"
          style={{ backgroundImage: LISTRAS }}
          aria-hidden="true"
        />
        Projeção
      </li>
      <li className="flex items-center gap-2">
        <span className="h-4 border-l-2 border-dashed border-foreground/70" aria-hidden="true" />
        Onde deveria estar hoje
      </li>
    </ul>
  );
}

function Indicadores({ r, faturado, meta }: { r: Ritmo; faturado: number; meta: number }) {
  const acima = faturado >= meta;
  const itens = [
    {
      k: acima ? "Acima da meta" : "Falta para a meta",
      v: <Contador valor={acima ? faturado - meta : r.falta} formatar={formatarMoeda} />,
      d: null,
    },
    r.concluido
      ? { k: "Ritmo necessário", v: "Concluído", d: "Mês encerrado" }
      : {
          k: "Ritmo necessário por dia útil",
          v: <Contador valor={r.ritmoNecessario} formatar={formatarMoeda} />,
          d: `${r.restantes} ${r.restantes === 1 ? "dia útil restante" : "dias úteis restantes"}`,
        },
    {
      k: r.concluido ? "Fechamento do mês" : "Projeção do mês",
      v: <Contador valor={r.projecao} formatar={formatarMoeda} />,
      d: `${pctTxt(r.projecaoPct)} da meta`,
    },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {itens.map((i) => (
        <div key={i.k} className="rounded-lg border p-3">
          <dt className="text-sm text-muted-foreground">{i.k}</dt>
          <dd className="numeros font-display text-xl font-bold">{i.v}</dd>
          {i.d && <dd className="text-sm text-muted-foreground">{i.d}</dd>}
        </div>
      ))}
    </dl>
  );
}
