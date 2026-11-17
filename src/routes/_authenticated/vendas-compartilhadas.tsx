import { createFileRoute } from "@tanstack/react-router";
import { TelaVendasCompartilhadas } from "@/modulos/vendas/TelaVendasCompartilhadas";

export const Route = createFileRoute("/_authenticated/vendas-compartilhadas")({
  head: () => ({
    meta: [
      { title: "Vendas compartilhadas — Rota CENTERFRIOS" },
      { name: "description", content: "Vendas com dois vendedores e a sua parte de 50%." },
    ],
  }),
  component: TelaVendasCompartilhadas,
});
