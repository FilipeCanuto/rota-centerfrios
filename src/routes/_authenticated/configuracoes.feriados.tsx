import { createFileRoute } from "@tanstack/react-router";
import { TelaFeriados } from "@/modulos/configuracoes/feriados/TelaFeriados";

export const Route = createFileRoute("/_authenticated/configuracoes/feriados")({
  head: () => ({
    meta: [
      { title: "Feriados e dias sem expediente — Rota CENTERFRIOS" },
      {
        name: "description",
        content: "Calendário de feriados e dias sem expediente usado nas metas e prazos.",
      },
      { property: "og:title", content: "Feriados e dias sem expediente — Rota CENTERFRIOS" },
      {
        property: "og:description",
        content: "Calendário de feriados e dias sem expediente usado nas metas e prazos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TelaFeriados,
});
