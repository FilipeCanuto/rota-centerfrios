import { useId } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { useHistoricoImportacoes } from "./dados";

const quando = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Maceio",
});
const TIPO: Record<string, string> = {
  clientes: "Clientes",
  vendas: "Vendas",
  orcamentos: "Orçamentos",
};

export function Historico() {
  const id = useId();
  const h = useHistoricoImportacoes();
  return (
    <section aria-labelledby={id} className="cartao p-5">
      <h2 id={id} className="mb-3 text-lg font-bold">
        Últimas importações
      </h2>
      {h.error ? (
        <EstadoErro
          titulo="Não foi possível carregar o histórico."
          aoTentar={() => h.refetch()}
          tentando={h.isFetching}
        />
      ) : !h.data ? (
        <Skeleton className="h-20 rounded-lg" />
      ) : h.data.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma importação ainda.</p>
      ) : (
        <ul className="divide-y">
          {h.data.map((i) => (
            <li key={i.id} className="flex flex-wrap gap-x-3 py-2 text-sm">
              <time dateTime={i.created_at} className="numeros">
                {quando.format(new Date(i.created_at))}
              </time>
              <span className="font-semibold">{TIPO[i.tipo] ?? i.tipo}</span>
              <span className="text-muted-foreground">{i.arquivo}</span>
              <span className="ml-auto numeros">
                {i.inseridas} novos · {i.atualizadas} atualizados · {i.ignoradas} com erro
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
