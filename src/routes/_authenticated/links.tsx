import { createFileRoute } from "@tanstack/react-router";
import { TelaLinks } from "@/modulos/links/TelaLinks";

export const Route = createFileRoute("/_authenticated/links")({
  head: () => ({
    meta: [
      { title: "Links e arquivos — Rota CENTERFRIOS" },
      { name: "description", content: "Catálogos, tabelas e arquivos para enviar aos clientes." },
    ],
  }),
  component: TelaLinks,
});
