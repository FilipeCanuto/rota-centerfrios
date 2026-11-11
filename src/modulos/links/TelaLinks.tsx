import { Link2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { useSessao } from "@/modulos/sessao/sessao";
import { useLinks, type Link } from "./dados";
import { FormLink } from "./FormLink";
import { ItemLink } from "./ItemLink";

export function TelaLinks() {
  const { data: sessao } = useSessao();
  const q = useLinks();
  const [form, setForm] = useState<{ link: Link | null } | null>(null);
  // Diretoria e administrador escrevem (RLS); os demais só consultam.
  const podeEditar = !!sessao?.papeis.some((p) => p === "diretoria" || p === "administrador");
  const empresas = sessao?.empresas ?? [];
  const nomeEmpresa = (id: string | null) =>
    id ? (empresas.find((e) => e.id === id)?.nome ?? "") : "As duas empresas";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Links e arquivos</h1>
        {podeEditar && (
          <Button className="ml-auto min-h-11" onClick={() => setForm({ link: null })}>
            <Plus aria-hidden="true" /> Novo link
          </Button>
        )}
      </div>
      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <EstadoErro
          titulo="Não foi possível carregar os links."
          aoTentar={() => void q.refetch()}
          tentando={q.isFetching}
        />
      ) : q.data.length === 0 ? (
        <EstadoVazio icone={Link2} titulo="Nenhum link ainda">
          <p>Catálogos, tabelas e páginas úteis para enviar aos clientes aparecem aqui.</p>
        </EstadoVazio>
      ) : (
        <ul className="cartao divide-y">
          {q.data.map((l) => (
            <ItemLink
              key={l.id}
              link={l}
              empresa={nomeEmpresa(l.empresa_id)}
              podeEditar={podeEditar}
              aoEditar={() => setForm({ link: l })}
            />
          ))}
        </ul>
      )}
      <FormLink
        aberto={!!form}
        link={form?.link ?? null}
        empresas={empresas}
        aoFechar={() => setForm(null)}
      />
    </div>
  );
}
