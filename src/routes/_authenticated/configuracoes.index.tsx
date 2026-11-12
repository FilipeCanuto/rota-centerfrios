import { createFileRoute } from "@tanstack/react-router";
import { abaValida } from "@/modulos/configuracoes/abas";
import { TelaConfiguracoes } from "@/modulos/configuracoes/TelaConfiguracoes";

export const Route = createFileRoute("/_authenticated/configuracoes/")({
  validateSearch: (s: Record<string, unknown>) => ({ aba: abaValida(s["aba"]) }),
  head: () => ({
    meta: [
      { title: "Configurações — Rota CENTERFRIOS" },
      { name: "description", content: "Configurações da plataforma, para administradores." },
      { property: "og:title", content: "Configurações — Rota CENTERFRIOS" },
      {
        property: "og:description",
        content: "Configurações da plataforma, para administradores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { aba } = Route.useSearch();
  return <TelaConfiguracoes aba={aba} />;
}
