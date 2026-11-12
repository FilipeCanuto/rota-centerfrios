import { createFileRoute, redirect } from "@tanstack/react-router";
import { levarLinkDeRecuperacao } from "@/modulos/sessao/recuperacao";
import { supabase } from "@/integrations/supabase/client";
import { Estrutura } from "@/modulos/layout/Estrutura";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    levarLinkDeRecuperacao("/_authenticated");
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Estrutura,
});
