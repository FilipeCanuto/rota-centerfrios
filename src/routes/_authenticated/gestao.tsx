import { createFileRoute } from "@tanstack/react-router";
import { TelaGestao } from "@/modulos/gestao/TelaGestao";

export const Route = createFileRoute("/_authenticated/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão — Rota CENTERFRIOS" },
      { name: "description", content: "Resumo da equipe: metas, cobertura e orçamentos parados." },
    ],
  }),
  component: TelaGestao,
});
