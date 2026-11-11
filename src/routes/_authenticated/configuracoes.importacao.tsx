import { createFileRoute } from "@tanstack/react-router";
import { TelaImportacao } from "@/modulos/configuracoes/importacao/TelaImportacao";

export const Route = createFileRoute("/_authenticated/configuracoes/importacao")({
  head: () => ({
    meta: [
      { title: "Importar planilhas do Shop9 — Rota CENTERFRIOS" },
      { name: "description", content: "Importação de clientes, vendas e orçamentos do Shop9." },
    ],
  }),
  component: TelaImportacao,
});
