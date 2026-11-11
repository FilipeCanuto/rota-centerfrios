import { createFileRoute } from "@tanstack/react-router";
import { ListaClientes } from "@/modulos/clientes/ListaClientes";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Rota CENTERFRIOS" },
      { name: "description", content: "Carteira de clientes do vendedor." },
      { property: "og:title", content: "Clientes — Rota CENTERFRIOS" },
      { property: "og:description", content: "Carteira de clientes do vendedor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListaClientes,
});
