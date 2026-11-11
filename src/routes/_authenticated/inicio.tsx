import { createFileRoute } from "@tanstack/react-router";
import { PainelInicio } from "@/modulos/inicio/PainelInicio";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Rota CENTERFRIOS" },
      {
        name: "description",
        content: "Meta do mês, cobertura da carteira, plano do dia e alertas.",
      },
      { property: "og:title", content: "Início — Rota CENTERFRIOS" },
      {
        property: "og:description",
        content: "Meta do mês, cobertura da carteira, plano do dia e alertas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelInicio,
});
