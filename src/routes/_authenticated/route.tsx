import { createFileRoute, redirect } from "@tanstack/react-router";
import { levarLinkDeRecuperacao } from "@/modulos/sessao/recuperacao";
import { supabase } from "@/integrations/supabase/client";
import { Estrutura } from "@/modulos/layout/Estrutura";
import { consultaSessao } from "@/modulos/sessao/sessao";
import { CHAVES_DISPONIVEIS, ROTAS_POR_SETOR } from "@/modulos/setores/setores";
import { setorDaRota } from "@/regras";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    levarLinkDeRecuperacao("/_authenticated");
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    // Guarda única por setor. É só navegação: quem decide o acesso aos dados é o banco (tem_setor).
    const setor = setorDaRota(location.pathname, ROTAS_POR_SETOR);
    if (!setor) return;
    const sessao = await context.queryClient.ensureQueryData(consultaSessao);
    if (!CHAVES_DISPONIVEIS.includes(setor) || !sessao?.setores.includes(setor))
      throw redirect({ to: "/setores", search: { trocar: false } });
  },
  component: Estrutura,
});
