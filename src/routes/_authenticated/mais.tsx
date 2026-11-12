import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarOff, FileText, FileUp, Link2, Trash2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAnunciar } from "@/design-system/Anunciador";
import { useApagarDemo } from "@/modulos/configuracoes/dados";
import { useSessao } from "@/modulos/sessao/sessao";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({
    meta: [
      { title: "Mais — Rota CENTERFRIOS" },
      { name: "description", content: "Atalhos, configurações e dados de demonstração." },
      { property: "og:title", content: "Mais — Rota CENTERFRIOS" },
      {
        property: "og:description",
        content: "Atalhos, configurações e dados de demonstração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Mais,
});

function Mais() {
  const { data } = useSessao();
  const apagar = useApagarDemo();
  const anunciar = useAnunciar();
  const admin = data?.papeis.includes("administrador");
  const diretoria = data?.papeis.includes("diretoria");
  const gestor = diretoria || data?.papeis.includes("supervisor");

  async function apagarDemo() {
    try {
      await apagar.mutateAsync();
    } catch {
      toast.error("Não foi possível apagar os dados de demonstração.");
      return;
    }
    toast.success("Dados de demonstração apagados.");
    anunciar("Dados de demonstração apagados.");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Mais</h1>
      <section aria-labelledby="atalhos" className="cartao p-5">
        <h2 id="atalhos" className="mb-3 text-lg font-bold">
          Atalhos
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal text-left">
            <Link to="/orcamentos">
              <FileText aria-hidden="true" /> Orçamentos
            </Link>
          </Button>
          {gestor && (
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-11 whitespace-normal text-left"
            >
              <Link to="/gestao">
                <Users aria-hidden="true" /> Gestão da equipe
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal text-left">
            <Link to="/gamificacao">
              <Trophy aria-hidden="true" /> Pontos e selos
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal text-left">
            <Link to="/links">
              <Link2 aria-hidden="true" /> Links e arquivos
            </Link>
          </Button>
        </div>
      </section>
      {diretoria && (
        <section aria-labelledby="config" className="cartao p-5">
          <h2 id="config" className="mb-2 text-lg font-bold">
            Configurações
          </h2>
          <p className="mb-4 text-muted-foreground">
            Feriados e dias sem expediente que deixam de contar como dia útil nas metas e prazos.
          </p>
          <Button asChild variant="outline" className="h-auto whitespace-normal text-left">
            <Link to="/configuracoes/feriados">
              <CalendarOff aria-hidden="true" /> Feriados e dias sem expediente
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="ml-0 mt-2 h-auto whitespace-normal text-left sm:ml-2 sm:mt-0"
          >
            <Link to="/configuracoes/importacao">
              <FileUp aria-hidden="true" /> Importar planilhas do Shop9
            </Link>
          </Button>
        </section>
      )}
      {admin && (
        <section aria-labelledby="demo" className="cartao p-5">
          <h2 id="demo" className="mb-2 text-lg font-bold">
            Dados de demonstração
          </h2>
          <p className="mb-4 text-muted-foreground">
            Os clientes, vendas, orçamentos e interações fictícios estão marcados como demonstração.
            Apague-os antes de começar a usar dados reais.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 aria-hidden="true" /> Apagar dados de demonstração
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados de demonstração?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação não pode ser desfeita. Seu usuário e as regras configuradas são
                  mantidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
                <AlertDialogAction className="min-h-11" onClick={apagarDemo}>
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}
    </div>
  );
}
