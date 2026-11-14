import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarOff, FileUp, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { useSessao } from "@/modulos/sessao/sessao";
import { ABAS_CONFIGURACAO } from "./abas";

export function TelaConfiguracoes({ aba }: { aba: string }) {
  const { data: sessao, isLoading } = useSessao();
  const navigate = useNavigate();
  if (isLoading)
    return <Skeleton className="h-40 rounded-xl" role="status" aria-label="Carregando" />;
  const admin = sessao?.papeis.includes("administrador");
  const diretoria = sessao?.papeis.includes("diretoria");
  if (!admin && !diretoria)
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Configurações</h1>
        <EstadoVazio icone={ShieldAlert} titulo="Só administradores e diretoria acessam">
          Se precisar mudar algo aqui, peça a um administrador.
        </EstadoVazio>
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Configurações</h1>
      {diretoria && (
        <section aria-labelledby="config-comercial" className="cartao p-5">
          <h2 id="config-comercial" className="mb-3 text-lg font-bold">
            Comercial
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
              <Link to="/configuracoes/feriados">
                <CalendarOff aria-hidden="true" /> Feriados e dias sem expediente
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
              <Link to="/configuracoes/importacao">
                <FileUp aria-hidden="true" /> Importar planilhas do Shop9
              </Link>
            </Button>
          </div>
        </section>
      )}
      {admin && (
        <Tabs
          value={aba}
          onValueChange={(v) =>
            void navigate({ to: "/configuracoes", search: { aba: v }, replace: true })
          }
        >
          <TabsList
            aria-label="Seções das configurações"
            className="h-auto max-w-full justify-start overflow-x-auto p-1"
          >
            {ABAS_CONFIGURACAO.map(({ id, rotulo, icone: Icone }) => (
              <TabsTrigger key={id} value={id} className="min-h-11 gap-2 px-4">
                <Icone className="size-4" aria-hidden="true" /> {rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
          {ABAS_CONFIGURACAO.map(({ id, Componente }) => (
            <TabsContent key={id} value={id} className="mt-6">
              <Componente />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
