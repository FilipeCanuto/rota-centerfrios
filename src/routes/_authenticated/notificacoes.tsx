import { createFileRoute } from "@tanstack/react-router";
import { TelaNotificacoes } from "@/modulos/notificacoes/TelaNotificacoes";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Rota CENTERFRIOS" },
      { name: "description", content: "Avisos sobre clientes, orçamentos e metas." },
    ],
  }),
  component: TelaNotificacoes,
});
