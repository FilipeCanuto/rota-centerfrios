import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
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
  if (!sessao?.papeis.includes("administrador"))
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Configurações</h1>
        <EstadoVazio icone={ShieldAlert} titulo="Só administradores acessam as configurações">
          Se precisar mudar algo aqui, peça a um administrador.
        </EstadoVazio>
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Configurações</h1>
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
    </div>
  );
}
