import { createFileRoute } from "@tanstack/react-router";
import { TelaOrcamentos } from "@/modulos/orcamentos/TelaOrcamentos";

export const Route = createFileRoute("/_authenticated/orcamentos")({
  head: () => ({
    meta: [
      { title: "Orçamentos — Rota CENTERFRIOS" },
      { name: "description", content: "Orçamentos abertos, parados e retornos do vendedor." },
    ],
  }),
  component: TelaOrcamentos,
});
