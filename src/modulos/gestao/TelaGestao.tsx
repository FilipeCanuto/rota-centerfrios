import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { formatarMoeda } from "@/design-system/formatar";
import { Progresso } from "@/design-system/Progresso";
import { useEmpresasAtivas, useSessao } from "@/modulos/sessao/sessao";
import {
  formatarISO,
  hojeEmMaceio,
  resumirVendedor,
  somarEquipe,
  type LinhaGestao,
} from "@/regras";
import { useGestao, type GestaoEmpresa } from "./dados";

const pct = (v: number | null) => (v === null ? "sem meta" : `${Math.round(v * 100)}%`);

export function TelaGestao() {
  const { data: sessao } = useSessao();
  const empresas = useEmpresasAtivas();
  const hojeData = hojeEmMaceio();
  const q = useGestao(empresas, formatarISO(hojeData));
  const permitido = sessao?.papeis.some((p) => p === "supervisor" || p === "diretoria");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Gestão</h1>
      {sessao && !permitido ? (
        <EstadoVazio icone={Users} titulo="Área da supervisão">
          <p>A gestão da equipe é exclusiva de supervisores e da diretoria.</p>
        </EstadoVazio>
      ) : q.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : q.isError ? (
        <EstadoErro
          titulo="Não foi possível carregar a gestão."
          aoTentar={() => void q.refetch()}
          tentando={q.isFetching}
        />
      ) : (
        q.data.map((g) => (
          <Empresa
            key={g.empresaId}
            g={g}
            hoje={hojeData}
            nome={
              q.data.length > 1
                ? sessao?.empresas.find((e) => e.id === g.empresaId)?.nome
                : undefined
            }
          />
        ))
      )}
    </div>
  );
}

function Empresa({ g, hoje, nome }: { g: GestaoEmpresa; hoje: Date; nome?: string | undefined }) {
  const total = somarEquipe(g.linhas);
  if (g.linhas.length === 0)
    return (
      <EstadoVazio icone={Users} titulo={nome ? `${nome}: nenhum vendedor` : "Nenhum vendedor"}>
        <p>Quando houver vendedores na equipe, o resumo de cada um aparece aqui.</p>
      </EstadoVazio>
    );
  return (
    <section className="flex flex-col gap-4" aria-label={nome ?? "Equipe"}>
      {nome && <h2 className="text-xl font-bold">{nome}</h2>}
      <div className="cartao p-5">
        <h3 className="mb-2 text-lg font-bold">Total da equipe</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dado k="Meta do mês" v={formatarMoeda(total.meta)} />
          <Dado k="Faturado no mês" v={formatarMoeda(total.faturado)} />
          <Dado k="Atingimento" v={pct(total.atingimento)} />
          <Dado k="Faturado hoje" v={formatarMoeda(total.faturadoHoje)} />
        </dl>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {g.linhas.map((l) => (
          <Vendedor key={l.vendedor_id} l={l} g={g} hoje={hoje} />
        ))}
      </ul>
    </section>
  );
}

function Dado({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{k}</dt>
      <dd className="numeros font-display text-lg font-bold">{v}</dd>
    </div>
  );
}

function Vendedor({ l, g, hoje }: { l: LinhaGestao; g: GestaoEmpresa; hoje: Date }) {
  const r = resumirVendedor(l, hoje, g.cfg, g.feriados);
  const metaCob = l.meta?.meta_cobertura ?? 0;
  return (
    <li className="cartao flex flex-col gap-3 p-5">
      <div>
        <h3 className="text-lg font-bold">{l.nome}</h3>
        {l.equipe && <p className="text-sm text-muted-foreground">{l.equipe}</p>}
      </div>
      {r.atingimento === null ? (
        <p className="text-muted-foreground">Sem meta cadastrada neste mês.</p>
      ) : (
        <>
          <p className="font-semibold">{`Meta de vendas: ${pct(r.atingimento)} (esperado até hoje ${pct(r.esperado)})`}</p>
          <Progresso valor={Math.min(r.atingimento, 1)} rotulo="Atingimento da meta de vendas" />
          <p className="numeros text-sm">
            {formatarMoeda(Number(l.faturado_mes))} de {formatarMoeda(Number(l.meta?.meta_vendas))}
          </p>
        </>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Dado k="Faturado hoje" v={formatarMoeda(Number(l.faturado_hoje))} />
        <Dado
          k="Cobertura do mês"
          v={`${pct(r.cobertura)}${metaCob > 0 ? ` (meta ${metaCob}%)` : ""}`}
        />
        <Dado k="Orçamentos parados" v={String(r.orcamentosParados)} />
        <Dado
          k={`Sem compra há ${g.cfg.cliente_sem_compra_dias}+ dias`}
          v={String(l.clientes_sem_compra_90)}
        />
        <Dado k="Clientes esquecidos" v={String(l.esquecidos)} />
        <Dado k="Orçamentos abertos" v={String(l.orcamentos_abertos.length)} />
      </dl>
    </li>
  );
}
