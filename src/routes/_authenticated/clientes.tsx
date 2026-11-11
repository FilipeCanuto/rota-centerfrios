import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { EstadoVazio } from "@/design-system/EstadoVazio";

export const Route = createFileRoute("/_authenticated/clientes")({
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
  component: () => (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Clientes</h1>
      <EstadoVazio icone={Users} titulo="Sua carteira completa vai aparecer aqui">
        Aqui você vai encontrar todos os clientes da sua carteira, com filtros por segmento, status
        de recompra, última compra e histórico de contatos.
      </EstadoVazio>
    </div>
  ),
});
