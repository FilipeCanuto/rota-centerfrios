import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAnunciar } from "@/design-system/Anunciador";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/modulos/sessao/sessao";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({
    meta: [
      { title: "Mais — Rota CENTERFRIOS" },
      { name: "description", content: "Configurações, design system e dados de demonstração." },
      { property: "og:title", content: "Mais — Rota CENTERFRIOS" },
      { property: "og:description", content: "Configurações, design system e dados de demonstração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Mais,
});

function Mais() {
  const { data } = useSessao();
  const qc = useQueryClient();
  const anunciar = useAnunciar();
  const admin = data?.papeis.includes("administrador");

  async function apagarDemo() {
    const { error } = await supabase.rpc("apagar_dados_demo");
    if (error) { toast.error("Não foi possível apagar os dados de demonstração."); return; }
    toast.success("Dados de demonstração apagados."); anunciar("Dados de demonstração apagados.");
    qc.invalidateQueries();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Mais</h1>
      <section aria-labelledby="ds" className="cartao p-5">
        <h2 id="ds" className="mb-2 text-lg font-bold">Design system Polar</h2>
        <p className="mb-4 text-muted-foreground">Tokens de cor, tipografia e componentes nos temas claro e escuro.</p>
        <Button asChild variant="outline"><Link to="/design-system"><Palette aria-hidden="true" /> Abrir design system</Link></Button>
      </section>
      {admin && (
        <section aria-labelledby="demo" className="cartao p-5">
          <h2 id="demo" className="mb-2 text-lg font-bold">Dados de demonstração</h2>
          <p className="mb-4 text-muted-foreground">Os clientes, vendas, orçamentos e interações fictícios estão marcados como demonstração. Apague-os antes de começar a usar dados reais.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 aria-hidden="true" /> Apagar dados de demonstração</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados de demonstração?</AlertDialogTitle>
                <AlertDialogDescription>Essa ação não pode ser desfeita. Seu usuário e as regras configuradas são mantidos.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
                <AlertDialogAction className="min-h-11" onClick={apagarDemo}>Apagar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}
    </div>
  );
}
