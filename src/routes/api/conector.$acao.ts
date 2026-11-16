import { createFileRoute } from "@tanstack/react-router";

// Só servidor: o módulo .server (com service_role) é carregado dentro do handler.
export const Route = createFileRoute("/api/conector/$acao")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { atenderConector } = await import("@/integracoes/conectorServidor.server");
        return atenderConector(request, params.acao);
      },
    },
  },
});
