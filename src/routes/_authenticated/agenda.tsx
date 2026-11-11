import { createFileRoute } from "@tanstack/react-router";
import { TelaAgenda } from "@/modulos/agenda/TelaAgenda";

interface BuscaAgenda {
  cliente?: string;
  nome?: string;
  empresa?: string;
}

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Rota CENTERFRIOS" },
      { name: "description", content: "Retornos, visitas, ligações e tarefas do vendedor." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): BuscaAgenda => {
    const texto = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : undefined);
    const [cliente, nome, empresa] = [texto("cliente"), texto("nome"), texto("empresa")];
    return cliente && nome && empresa ? { cliente, nome, empresa } : {};
  },
  component: Agenda,
});

function Agenda() {
  const { cliente, nome, empresa } = Route.useSearch();
  return (
    <TelaAgenda
      novoPara={
        cliente && nome && empresa ? { clienteId: cliente, nome, empresaId: empresa } : undefined
      }
    />
  );
}
