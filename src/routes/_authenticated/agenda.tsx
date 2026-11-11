import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TelaAgenda } from "@/modulos/agenda/TelaAgenda";

/** Só o id do cliente vai no endereço; o nome é buscado na tela. */
interface BuscaAgenda {
  cliente?: string;
}

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Rota CENTERFRIOS" },
      { name: "description", content: "Retornos, visitas, ligações e tarefas do vendedor." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): BuscaAgenda =>
    typeof s["cliente"] === "string" ? { cliente: s["cliente"] } : {},
  component: Agenda,
});

function Agenda() {
  const { cliente } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <TelaAgenda
      novoPara={cliente}
      // Tira o cliente do endereço: voltar ou recarregar não reabre o formulário.
      aoUsarNovoPara={() => void navigate({ to: "/agenda", search: {}, replace: true })}
    />
  );
}
