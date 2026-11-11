import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useEmpresasAtivas, useSessao } from "@/modulos/sessao/sessao";
import { clienteSemCompra, hojeEmMaceio, paraData, REGRAS_PADRAO } from "@/regras";
import {
  FILTROS_VAZIOS,
  useListaClientes,
  useOpcoesFiltro,
  usePessoasVisiveis,
  useRegrasPorEmpresa,
  type FiltrosClientes,
} from "./dados";

const TODOS = "todos";
const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ListaClientes() {
  const id = useId();
  const { data: sessao } = useSessao();
  const empresas = useEmpresasAtivas();
  const gestao = !!sessao?.papeis.some((p) => p === "supervisor" || p === "diretoria");
  const regras = useRegrasPorEmpresa(empresas).data ?? {};
  const cfgDe = (empresa: string) => regras[empresa] ?? REGRAS_PADRAO;
  const dias = Object.fromEntries(empresas.map((e) => [e, cfgDe(e).cliente_sem_compra_dias]));
  const diasTexto = [...new Set(Object.values(dias))].join(" ou ");
  const [filtros, setFiltros] = useState<FiltrosClientes>(FILTROS_VAZIOS);
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(0);
  // Espera parar de digitar para não fazer uma consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => ({ ...f, texto })), 300);
    return () => clearTimeout(t);
  }, [texto]);
  useEffect(() => setPagina(0), [filtros]);

  const lista = useListaClientes(empresas, filtros, pagina, dias);
  const opcoes = useOpcoesFiltro(empresas).data;
  const pessoas = usePessoasVisiveis().data ?? [];
  const nomeVendedor = new Map(pessoas.map((p) => [p.id, p.nome]));
  const hoje = hojeEmMaceio();
  const mudar = (p: Partial<FiltrosClientes>) => setFiltros((f) => ({ ...f, ...p }));
  const filtrando = JSON.stringify({ ...filtros, texto }) !== JSON.stringify(FILTROS_VAZIOS);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Clientes</h1>

      <section
        aria-labelledby={`${id}-filtros`}
        className="cartao grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id={`${id}-filtros`} className="sr-only">
          Filtros
        </h2>
        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor={`${id}-busca`}>Buscar por nome ou cidade</Label>
          <Input
            id={`${id}-busca`}
            type="search"
            className="min-h-11"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <Filtro
          rotulo="Segmento"
          valor={filtros.segmento}
          opcoes={opcoes?.segmentos ?? []}
          aoMudar={(segmento) => mudar({ segmento })}
        />
        <Filtro
          rotulo="Etiqueta"
          valor={filtros.etiqueta}
          opcoes={opcoes?.etiquetas ?? []}
          aoMudar={(etiqueta) => mudar({ etiqueta })}
        />
        {gestao && (
          <Filtro
            rotulo="Vendedor"
            valor={filtros.vendedorId}
            opcoes={pessoas.map((p) => p.id)}
            nomes={nomeVendedor}
            aoMudar={(vendedorId) => mudar({ vendedorId })}
          />
        )}
        <div className="flex min-h-11 items-center gap-3 sm:col-span-2 lg:col-span-4">
          <Checkbox
            id={`${id}-sem-compra`}
            checked={filtros.semCompra90}
            onCheckedChange={(v) => mudar({ semCompra90: v === true })}
          />
          <Label htmlFor={`${id}-sem-compra`} className="font-normal">
            Só clientes sem compra há {diasTexto} dias ou mais
          </Label>
          {filtrando && (
            <Button
              variant="link"
              className="ml-auto px-0"
              onClick={() => {
                setTexto("");
                setFiltros(FILTROS_VAZIOS);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby={`${id}-lista`} aria-busy={lista.isFetching}>
        <h2 id={`${id}-lista`} className="mb-3 text-lg font-bold">
          {lista.data
            ? `${lista.data.total} ${lista.data.total === 1 ? "cliente" : "clientes"}`
            : "Carteira"}
        </h2>
        {lista.isError && lista.data && (
          <p role="alert" className="mb-3 font-semibold text-perigo">
            Não foi possível atualizar a lista com os filtros novos. Mostrando o resultado anterior.
          </p>
        )}
        {lista.error && !lista.data ? (
          <EstadoErro
            titulo="Não foi possível carregar os clientes."
            aoTentar={() => lista.refetch()}
            tentando={lista.isFetching}
          />
        ) : !lista.data ? (
          <div className="flex flex-col gap-2" role="status">
            <span className="sr-only">Carregando clientes…</span>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : lista.data.clientes.length === 0 ? (
          <EstadoVazio
            icone={Users}
            titulo={
              filtrando ? "Nenhum cliente com esses filtros" : "Sua carteira ainda está vazia"
            }
          >
            {filtrando
              ? "Tente outro nome ou limpe os filtros."
              : "Os clientes aparecem aqui quando a diretoria importa a planilha do Shop9 ou atribui clientes a você."}
          </EstadoVazio>
        ) : (
          <>
            <ul className="cartao divide-y">
              {lista.data.clientes.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/clientes/$id"
                    params={{ id: c.id }}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transicao hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.nome}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[
                          c.segmento,
                          c.cidade,
                          gestao && c.vendedor_id ? nomeVendedor.get(c.vendedor_id) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      {c.etiquetas.map((e) => (
                        <span key={e} className="rounded-full bg-secondary px-2 py-0.5">
                          {e}
                        </span>
                      ))}
                      {clienteSemCompra(c.data_ultima_compra, hoje, cfgDe(c.empresa_id)) ? (
                        <SeloStatus tom="atencao">
                          {c.data_ultima_compra
                            ? `Sem compra há ${cfgDe(c.empresa_id).cliente_sem_compra_dias}+ dias`
                            : "Nunca comprou"}
                        </SeloStatus>
                      ) : (
                        <span className="text-muted-foreground">
                          Última compra{" "}
                          <time dateTime={c.data_ultima_compra!}>
                            {dataCurta.format(paraData(c.data_ultima_compra!))}
                          </time>
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {lista.data.temMais && (
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setPagina((p) => p + 1)}
                disabled={lista.isFetching}
              >
                {lista.isFetching ? "Carregando…" : "Mostrar mais clientes"}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Filtro({
  rotulo,
  valor,
  opcoes,
  nomes,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  opcoes: string[];
  nomes?: Map<string, string>;
  aoMudar: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select value={valor || TODOS} onValueChange={(v) => aoMudar(v === TODOS ? "" : v)}>
        <SelectTrigger id={id} className="min-h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS} className="min-h-11">
            Todos
          </SelectItem>
          {opcoes.map((o) => (
            <SelectItem key={o} value={o} className="min-h-11">
              {nomes?.get(o) ?? o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
