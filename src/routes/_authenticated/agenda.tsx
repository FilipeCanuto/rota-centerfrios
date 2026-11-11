import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { EstadoVazio } from "@/design-system/EstadoVazio";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Rota CENTERFRIOS" },
      { name: "description", content: "Tarefas e visitas agendadas." },
      { property: "og:title", content: "Agenda — Rota CENTERFRIOS" },
      { property: "og:description", content: "Tarefas e visitas agendadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Agenda</h1>
      <EstadoVazio icone={CalendarDays} titulo="Sua agenda vai aparecer aqui">
        Os próximos passos que você registra em cada contato viram tarefas aqui, organizadas por
        dia, junto com as visitas planejadas.
      </EstadoVazio>
    </div>
  ),
});
