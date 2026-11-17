import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Voltar para a aba ou trocar de tela não refaz tudo; quem grava já invalida a consulta.
        staleTime: 30_000,
        // Erro com código do banco/API (sem acesso, função ausente) não melhora repetindo; rede tenta 2 vezes.
        retry: (falhas, erro) => !(erro as { code?: string } | null)?.code && falhas < 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Troca de tela com fade (View Transitions nativa; sem suporte, troca direta).
    defaultViewTransition: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
