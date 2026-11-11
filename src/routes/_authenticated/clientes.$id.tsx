import { createFileRoute } from "@tanstack/react-router";
import { FichaCliente } from "@/modulos/clientes/FichaCliente";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do cliente — Rota CENTERFRIOS" },
      { name: "description", content: "Compras, orçamentos, contatos e notas do cliente." },
    ],
  }),
  component: Ficha,
});

function Ficha() {
  const { id } = Route.useParams();
  return <FichaCliente clienteId={id} />;
}
