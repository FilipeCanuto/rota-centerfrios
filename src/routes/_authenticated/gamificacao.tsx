import { createFileRoute } from "@tanstack/react-router";
import { TelaGamificacao } from "@/modulos/gamificacao/TelaGamificacao";

export const Route = createFileRoute("/_authenticated/gamificacao")({
  head: () => ({
    meta: [
      { title: "Pontos e selos — Rota CENTERFRIOS" },
      { name: "description", content: "Pontos, selos, ranking e posts do Instagram." },
    ],
  }),
  component: TelaGamificacao,
});
