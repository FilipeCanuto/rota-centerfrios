import { createFileRoute, redirect } from "@tanstack/react-router";
import { levarLinkDeRecuperacao } from "@/modulos/sessao/recuperacao";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rota CENTERFRIOS — Plataforma comercial" },
      {
        name: "description",
        content:
          "Painel dos vendedores CENTERFRIOS e 381 Distribuidora: metas, carteira e plano do dia.",
      },
      { property: "og:title", content: "Rota CENTERFRIOS — Plataforma comercial" },
      {
        property: "og:description",
        content:
          "Painel dos vendedores CENTERFRIOS e 381 Distribuidora: metas, carteira e plano do dia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    levarLinkDeRecuperacao();
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/inicio" : "/auth" });
  },
  component: () => null,
});
