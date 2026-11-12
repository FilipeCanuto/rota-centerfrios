import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paraData, type EventoCalendario } from "@/regras";
import { IconeEvento, TIPOS_EVENTO } from "./Calendario";
import type { Tarefa } from "./dados";
import { ItemTarefa } from "./ItemTarefa";

const diaLongo = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Um dia da agenda: feriados, retornos de orçamento, recompras previstas e as tarefas, com "Agendar". */
export function DiaDaAgenda({
  dia,
  hoje,
  comTitulo,
  tarefas,
  extras,
  aoEditar,
  aoAgendar,
}: {
  dia: string;
  hoje: string;
  comTitulo: boolean;
  tarefas: Tarefa[];
  extras: EventoCalendario[];
  aoEditar: (t: Tarefa) => void;
  aoAgendar: () => void;
}) {
  const vazio = tarefas.length === 0 && extras.length === 0;
  return (
    <div className="cartao px-4 pb-3">
      <div className="flex flex-wrap items-center gap-2 pt-3">
        {comTitulo && (
          <h3 className="font-semibold first-letter:uppercase">
            <time dateTime={dia}>{diaLongo.format(paraData(dia))}</time>
            {dia === hoje && " (hoje)"}
          </h3>
        )}
        <Button variant="outline" className="ml-auto min-h-11" onClick={aoAgendar}>
          <Plus aria-hidden="true" /> Agendar neste dia
        </Button>
      </div>
      {vazio && <p className="py-3 text-muted-foreground">Nada marcado para este dia.</p>}
      {extras.length > 0 && (
        <ul className="divide-y">
          {extras.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-3">
              <IconeEvento tipo={e.tipo} className="size-5" />
              <span className="font-semibold">{e.titulo}</span>
              <span className="text-sm text-muted-foreground">
                {e.detalhe ?? TIPOS_EVENTO[e.tipo].rotulo}
              </span>
              {e.clienteId && (
                <Button asChild variant="link" className="ml-auto min-h-11">
                  <Link to="/clientes/$id" params={{ id: e.clienteId }}>
                    Ver cliente
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {tarefas.length > 0 && (
        <ul className="divide-y">
          {tarefas.map((t) => (
            <ItemTarefa
              key={t.id}
              tarefa={t}
              atrasada={!t.concluida && t.data < hoje}
              aoEditar={() => aoEditar(t)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
