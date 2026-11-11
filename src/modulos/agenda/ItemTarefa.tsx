import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SeloStatus } from "@/design-system/SeloStatus";
import { TIPOS_TAREFA, useConcluirTarefa, type Tarefa } from "./dados";

const ROTULO = Object.fromEntries(TIPOS_TAREFA.map((t) => [t.valor, t.rotulo]));

export function ItemTarefa({
  tarefa: t,
  atrasada,
  aoEditar,
}: {
  tarefa: Tarefa;
  atrasada: boolean;
  aoEditar: () => void;
}) {
  const concluir = useConcluirTarefa();
  const id = `tarefa-${t.id}`;
  function alternar(concluida: boolean) {
    concluir.mutate(
      { id: t.id, concluida },
      {
        onSuccess: () =>
          concluida &&
          toast(`"${t.titulo}" concluída.`, {
            action: {
              label: "Desfazer",
              onClick: () => concluir.mutate({ id: t.id, concluida: false }),
            },
          }),
        onError: () => toast.error("Não foi possível atualizar a tarefa."),
      },
    );
  }
  return (
    <li className="flex items-start gap-3 py-3">
      <Checkbox
        id={id}
        checked={t.concluida}
        onCheckedChange={(v) => alternar(v === true)}
        className="mt-1 size-5"
        aria-describedby={`${id}-info`}
      />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={`block font-semibold ${t.concluida ? "text-muted-foreground line-through" : ""}`}
        >
          {t.titulo}
        </label>
        <p
          id={`${id}-info`}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
        >
          <span>{ROTULO[t.tipo] ?? t.tipo}</span>
          {t.hora && <span className="numeros">{t.hora.slice(0, 5)}</span>}
          {t.clientes && t.cliente_id && (
            <Link
              to="/clientes/$id"
              params={{ id: t.cliente_id }}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t.clientes.nome}
            </Link>
          )}
          {t.motivo_alerta && <span>Criada pelo plano do dia</span>}
          {atrasada && !t.concluida && <SeloStatus tom="perigo">Atrasada</SeloStatus>}
        </p>
        {t.observacao && <p className="text-sm">{t.observacao}</p>}
      </div>
      <Button variant="ghost" size="icon" onClick={aoEditar} aria-label={`Editar ${t.titulo}`}>
        <Pencil aria-hidden="true" />
      </Button>
    </li>
  );
}
