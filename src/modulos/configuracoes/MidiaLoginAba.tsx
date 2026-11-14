import { ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { EnvioMidiaLogin } from "./EnvioMidiaLogin";
import { ListaMidiaLogin } from "./ListaMidiaLogin";
import { PreviaPalco } from "./PreviaPalco";
import { useMidiaLogin } from "./midiaLogin";

/** Aba "Mídia do login": a prévia usa o mesmo palco da tela de entrada, só com as mídias ativas. */
export default function MidiaLoginAba() {
  const { data, isLoading, isError, refetch, isRefetching } = useMidiaLogin();
  if (isLoading)
    return <Skeleton className="h-64 rounded-xl" role="status" aria-label="Carregando" />;
  if (isError)
    return (
      <EstadoErro
        titulo="Não foi possível carregar as mídias"
        aoTentar={() => void refetch()}
        tentando={isRefetching}
      />
    );
  const itens = data ?? [];
  const ativos = itens.filter((m) => m.ativo);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Mídias ({itens.length})</h2>
        {itens.length ? (
          <ListaMidiaLogin itens={itens} />
        ) : (
          <EstadoVazio icone={ImageOff} titulo="Nenhuma mídia cadastrada">
            Sem mídia, o login mostra o fundo animado da marca. Envie a primeira abaixo.
          </EstadoVazio>
        )}
        <EnvioMidiaLogin proximaOrdem={itens.length} />
      </div>
      <section
        aria-labelledby="previa"
        className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start"
      >
        <h2 id="previa" className="text-lg font-bold">
          Prévia do login
        </h2>
        <PreviaPalco itens={ativos} />
        <p className="text-sm text-muted-foreground">
          Mostra só as mídias ativas, na ordem da lista, a cada 12 segundos. Use “Enquadrar” em cada
          mídia para escolher entre preencher (com ponto de foco) e ajustar sem cortar.
        </p>
      </section>
    </div>
  );
}
