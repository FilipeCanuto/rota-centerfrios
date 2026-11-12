import { Link2, Lock, Plus, Search, Users } from "lucide-react";
import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { useSessao } from "@/modulos/sessao/sessao";
import { useLinks, type Link } from "./dados";
import { FormLink } from "./FormLink";
import { ItemLink } from "./ItemLink";
import { filtrarLinks, type FiltroPublico } from "./publico";

const FILTROS: { valor: FiltroPublico; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "cliente", rotulo: "Para clientes" },
  { valor: "interno", rotulo: "Internos" },
];

export function TelaLinks() {
  const { data: sessao } = useSessao();
  const q = useLinks();
  const [form, setForm] = useState<{ link: Link | null } | null>(null);
  const [filtro, setFiltro] = useState<FiltroPublico>("todos");
  const [busca, setBusca] = useState("");
  // Diretoria e administrador escrevem (RLS); os demais só consultam.
  const podeEditar = !!sessao?.papeis.some((p) => p === "diretoria" || p === "administrador");
  const empresas = sessao?.empresas ?? [];
  const nomeEmpresa = (id: string | null) =>
    id ? (empresas.find((e) => e.id === id)?.nome ?? "") : "As duas empresas";

  const grupos = q.data ? filtrarLinks(q.data, filtro, busca) : null;
  const vazioMsg = busca.trim() ? "Nenhum link encontrado com essa busca." : undefined;

  const secao = (
    chave: "cliente" | "interno",
    titulo: string,
    descricao: string,
    Icone: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>,
    vazio: string,
  ) => {
    const lista = grupos?.[chave] ?? [];
    const idTitulo = `secao-${chave}`;
    return (
      <section aria-labelledby={idTitulo} className="flex flex-col gap-2">
        <div>
          <h2 id={idTitulo} className="flex items-center gap-2 font-display text-xl font-bold">
            <Icone className="size-5" aria-hidden="true" />
            {titulo}
            <span className="numeros text-base font-semibold text-muted-foreground">
              ({lista.length})
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        {lista.length === 0 ? (
          <p className="cartao p-4 text-sm text-muted-foreground">{vazioMsg ?? vazio}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lista.map((l) => (
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
      </section>
    );
  };

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
          <p>Catálogos, tabelas e páginas úteis aparecem aqui.</p>
        </EstadoVazio>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <Button
                  key={f.valor}
                  variant={filtro === f.valor ? "default" : "outline"}
                  className="min-h-11"
                  aria-pressed={filtro === f.valor}
                  onClick={() => setFiltro(f.valor)}
                >
                  {f.rotulo}
                </Button>
              ))}
            </div>
            <div className="grid gap-1.5 sm:ml-auto sm:w-72">
              <Label htmlFor="busca-links">Buscar</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="busca-links"
                  type="search"
                  className="min-h-11 pl-9"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Título ou descrição"
                />
              </div>
            </div>
          </div>
          {filtro !== "interno" &&
            secao(
              "cliente",
              "Para enviar aos clientes",
              "Pode ser copiado e enviado pelo WhatsApp.",
              Users,
              "Nenhum link liberado para clientes. Quem cadastra links pode marcar “Pode enviar a clientes”.",
            )}
          {filtro !== "cliente" &&
            secao(
              "interno",
              "Uso interno do time",
              "Não envie aos clientes.",
              Lock,
              "Nenhum link interno.",
            )}
        </>
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
