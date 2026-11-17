import { Handshake } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { formatarMoeda } from "@/design-system/formatar";
import { SeloStatus } from "@/design-system/SeloStatus";
import { paraData } from "@/regras";
import { useEmpresasAtivas } from "@/modulos/sessao/sessao";
import { useVendasCompartilhadas } from "./dados";

const dia = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function TelaVendasCompartilhadas() {
  const q = useVendasCompartilhadas(useEmpresasAtivas());
  const total = (q.data ?? []).reduce((s, v) => s + Number(v.minha_parte), 0);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Vendas compartilhadas</h1>
      <p className="text-muted-foreground">
        Vendas com dois vendedores nos últimos 12 meses. Cada um fica com 50% na meta; a devolução
        desconta dos dois.
      </p>
      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <EstadoErro
          titulo="Não foi possível carregar as vendas compartilhadas."
          aoTentar={() => void q.refetch()}
          tentando={q.isFetching}
        />
      ) : q.data.length === 0 ? (
        <EstadoVazio icone={Handshake} titulo="Nenhuma venda compartilhada">
          Quando uma nota vier do Shop9 com você como vendedor 1 ou 2, ela aparece aqui.
        </EstadoVazio>
      ) : (
        <>
          <p className="font-semibold">
            Sua parte no período: <span className="numeros">{formatarMoeda(total)}</span>
          </p>
          <ul className="cascata flex flex-col gap-3">
            {q.data.map((v) => (
              <li key={v.id} className="cartao flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {v.tipo === "devolucao" ? (
                    <SeloStatus tom="atencao">Devolução</SeloStatus>
                  ) : (
                    <SeloStatus tom="sucesso">Venda</SeloStatus>
                  )}
                  <h2 className="font-semibold">{v.cliente}</h2>
                  <time dateTime={v.data} className="text-sm text-muted-foreground">
                    {dia.format(paraData(v.data))}
                  </time>
                </div>
                <p className="text-sm">
                  Você é o vendedor {v.papel}
                  {v.outro_vendedor ? `, com ${v.outro_vendedor}` : ""}
                  {v.codigo_shop9 ? ` · nota ${v.codigo_shop9.replace(/^DEV:/, "")}` : ""}
                </p>
                <p className="flex flex-wrap gap-x-4">
                  <span>
                    Total <span className="numeros">{formatarMoeda(Number(v.valor))}</span>
                  </span>
                  <span className="font-semibold">
                    Sua parte{" "}
                    <span className="numeros">{formatarMoeda(Number(v.minha_parte))}</span>
                  </span>
                </p>
                {v.itens.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {v.itens.map((i) => `${i.quantidade}× ${i.produto}`).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
