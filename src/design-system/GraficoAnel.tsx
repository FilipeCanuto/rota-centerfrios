import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatarPercentual } from "./formatar";

interface Props {
  valor: number; // 0..n
  rotulo: string;
  resumo: string;
  tabela: { indicador: string; valor: string }[];
  tamanho?: "grande" | "pequeno";
}

const RAIO = 43;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

/** Gráfico em anel com resumo em texto e alternância "Ver como tabela". */
export function GraficoAnel({ valor, rotulo, resumo, tabela, tamanho = "grande" }: Props) {
  const [comoTabela, setComoTabela] = useState(false);
  const id = useId();
  const p = Math.max(0, Math.min(1, valor));
  const atingido = valor >= 1;
  const dim = tamanho === "grande" ? "size-44" : "size-32";

  return (
    <figure className="flex flex-col items-center gap-3" aria-labelledby={`${id}-cap`}>
      {comoTabela ? (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{rotulo}</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 font-semibold">
                Indicador
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {tabela.map((l) => (
              <tr key={l.indicador} className="border-b last:border-0">
                <th scope="row" className="py-2 font-normal">
                  {l.indicador}
                </th>
                <td className="numeros py-2 text-right">{l.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={`relative ${dim}`} aria-hidden="true">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={RAIO}
              fill="none"
              strokeWidth="13"
              className="stroke-trilha"
            />
            {atingido && (
              // Contorno marinho: o ouro sozinho não chega a 3:1 sobre o fundo claro.
              <circle
                cx="50"
                cy="50"
                r={RAIO}
                fill="none"
                strokeWidth="16"
                className="stroke-foreground"
              />
            )}
            <circle
              cx="50"
              cy="50"
              r={RAIO}
              fill="none"
              strokeWidth="13"
              strokeLinecap={p > 0 && p < 1 ? "round" : "butt"}
              strokeDasharray={`${p * CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
              className={`anel-entrar ${atingido ? "stroke-ouro" : "stroke-primary"}`}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span
              className={`numeros font-display font-extrabold ${tamanho === "grande" ? "text-3xl" : "text-2xl"}`}
            >
              {formatarPercentual(valor)}
            </span>
          </div>
        </div>
      )}
      <figcaption id={`${id}-cap`} className="text-center text-sm text-muted-foreground">
        {resumo}
      </figcaption>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setComoTabela((v) => !v)}
        aria-pressed={comoTabela}
      >
        {comoTabela ? "Ver como gráfico" : "Ver como tabela"}
      </Button>
    </figure>
  );
}
