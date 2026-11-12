import { useId } from "react";
import { SeloStatus, type TomStatus } from "@/design-system/SeloStatus";
import { formatarMoeda } from "@/design-system/formatar";
import { interacaoQualificada, paraData, type TipoInteracao } from "@/regras";
import type { Ficha } from "./dados";

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const data = (d: string) => <time dateTime={d}>{dataCurta.format(paraData(d))}</time>;
const TIPOS: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  visita: "Visita",
  outro: "Outro",
};
const STATUS: Record<string, { tom: TomStatus; rotulo: string }> = {
  aberto: { tom: "info", rotulo: "Aberto" },
  ganho: { tom: "sucesso", rotulo: "Ganho" },
  perdido: { tom: "perigo", rotulo: "Perdido" },
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="cartao p-5">
      <h2 id={id} className="mb-3 text-lg font-bold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function ItensMaisComprados({ ficha }: { ficha: Ficha }) {
  return (
    <Secao titulo="Itens mais comprados (12 meses)">
      {ficha.itens_mais_comprados.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum item registrado nas compras dos últimos 12 meses.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Itens mais comprados nos últimos 12 meses</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-2 font-semibold">
                  Produto
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Quantidade
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {ficha.itens_mais_comprados.map((i) => (
                <tr key={i.produto} className="border-b last:border-0">
                  <th scope="row" className="py-2 font-normal">
                    {i.produto}
                  </th>
                  <td className="numeros py-2 text-right">{i.quantidade}</td>
                  <td className="numeros py-2 text-right">
                    {formatarMoeda(Number(i.valor_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Secao>
  );
}

export function Compras({ ficha }: { ficha: Ficha }) {
  return (
    <Secao titulo="Últimas compras">
      {ficha.compras.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma compra faturada ainda.</p>
      ) : (
        <ol className="cascata divide-y">
          {ficha.compras.map((c) => (
            <li key={c.id} className="py-3">
              <p className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{data(c.data)}</span>
                <span className="numeros font-semibold">{formatarMoeda(Number(c.valor))}</span>
              </p>
              {c.itens.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {c.itens.map((i) => `${i.quantidade}× ${i.produto}`).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}

export function OrcamentosCliente({ ficha }: { ficha: Ficha }) {
  return (
    <Secao titulo={`Orçamentos (${ficha.orcamentos.length})`}>
      {ficha.orcamentos.length === 0 ? (
        <p className="text-muted-foreground">Nenhum orçamento para este cliente.</p>
      ) : (
        <ul className="cascata divide-y">
          {ficha.orcamentos.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <SeloStatus tom={STATUS[o.status]!.tom}>{STATUS[o.status]!.rotulo}</SeloStatus>
              <span>{data(o.data)}</span>
              <span className="numeros ml-auto font-semibold">
                {formatarMoeda(Number(o.valor))}
              </span>
              {o.status === "aberto" && o.proximo_followup && (
                <p className="w-full text-sm">Próximo retorno: {data(o.proximo_followup)}</p>
              )}
              {o.observacao && (
                <p className="w-full text-sm text-muted-foreground">{o.observacao}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

export function InteracoesCliente({ ficha }: { ficha: Ficha }) {
  return (
    <Secao titulo="Contatos recentes">
      {ficha.interacoes.length === 0 ? (
        <p className="text-muted-foreground">Nenhum contato registrado ainda.</p>
      ) : (
        <ol className="cascata divide-y">
          {ficha.interacoes.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="font-semibold">{TIPOS[i.tipo] ?? i.tipo}</span>
              <span className="text-muted-foreground">{data(i.dia_local)}</span>
              {interacaoQualificada({
                tipo: i.tipo as TipoInteracao,
                cliente_respondeu: i.cliente_respondeu,
                resultado: i.resultado,
              }) ? (
                <SeloStatus tom="sucesso">Qualificado</SeloStatus>
              ) : (
                <SeloStatus tom="info">Não qualificado</SeloStatus>
              )}
              {i.resultado && <p className="w-full text-sm text-muted-foreground">{i.resultado}</p>}
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}
