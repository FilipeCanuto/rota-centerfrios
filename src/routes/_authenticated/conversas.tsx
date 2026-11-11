import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { EstadoVazio } from "@/design-system/EstadoVazio";

export const Route = createFileRoute("/_authenticated/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas — Rota CENTERFRIOS" },
      { name: "description", content: "Conversas com clientes pelo WhatsApp e Instagram." },
      { property: "og:title", content: "Conversas — Rota CENTERFRIOS" },
      { property: "og:description", content: "Conversas com clientes pelo WhatsApp e Instagram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Conversas</h1>
      <EstadoVazio icone={MessageCircle} titulo="Suas conversas vão aparecer aqui">
        Quando o WhatsApp e o Instagram forem conectados, você verá aqui as conversas com seus
        clientes, com o histórico de cada um e respostas rápidas.
      </EstadoVazio>
    </div>
  ),
});
