import { Users } from "lucide-react";
import { SeloStatus } from "@/design-system/SeloStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { Contador } from "@/design-system/movimento";
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
  const permitido = sessao?.papeis.some((p) => p === "supervisor" || p === "diretoria");
  const q = useGestao(empresas, formatarISO(hojeData), !!permitido);

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
  // Sem nome de empresa não há h2 acima: os títulos dos cartões sobem um nível.
  const Titulo = nome ? "h3" : "h2";
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
        <Titulo className="mb-2 text-lg font-bold">Total da equipe</Titulo>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dado k="Meta do mês" v={<Contador valor={total.meta} formatar={formatarMoeda} />} />
          <Dado
            k="Faturado no mês"
            v={<Contador valor={total.faturado} formatar={formatarMoeda} />}
          />
          <Dado k="Atingimento" v={pct(total.atingimento)} />
          <Dado
            k="Faturado hoje"
            v={<Contador valor={total.faturadoHoje} formatar={formatarMoeda} />}
          />
        </dl>
      </div>
      <ul className="cascata grid gap-4 lg:grid-cols-2">
        {g.linhas.map((l) => (
          <Vendedor key={l.vendedor_id} l={l} g={g} hoje={hoje} Titulo={Titulo} />
        ))}
      </ul>
    </section>
  );
}

function Dado({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{k}</dt>
      <dd className="numeros font-display text-lg font-bold">{v}</dd>
    </div>
  );
}

function Vendedor({
  l,
  g,
  hoje,
  Titulo,
}: {
  l: LinhaGestao;
  g: GestaoEmpresa;
  hoje: Date;
  Titulo: "h2" | "h3";
}) {
  const r = resumirVendedor(l, hoje, g.cfg, g.feriados);
  const metaCob = l.meta?.meta_cobertura ?? 0;
  return (
    <li className="cartao cartao-interativo flex flex-col gap-3 p-5">
      <div>
        <Titulo className="text-lg font-bold">{l.nome}</Titulo>
        {l.equipe && <p className="text-sm text-muted-foreground">{l.equipe}</p>}
      </div>
      {r.atingimento === null ? (
        <p className="text-muted-foreground">Sem meta cadastrada neste mês.</p>
      ) : (
        <>
          <p className="font-semibold">{`Meta de vendas: ${pct(r.atingimento)} (esperado até hoje ${pct(r.esperado)})`}</p>
          <Progresso valor={Math.min(r.atingimento, 1)} rotulo="Atingimento da meta de vendas" />
          {r.esperado !== null && (
            <div>
              <SeloStatus tom={r.atingimento >= r.esperado ? "sucesso" : "atencao"}>
                {r.atingimento >= r.esperado ? "No ritmo da meta" : "Abaixo do esperado até hoje"}
              </SeloStatus>
            </div>
          )}
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
      {r.cobertura !== null && metaCob > 0 && (
        <div>
          <SeloStatus tom={r.cobertura * 100 >= metaCob ? "sucesso" : "atencao"}>
            {r.cobertura * 100 >= metaCob
              ? "Meta de cobertura batida"
              : "Abaixo da meta de cobertura"}
          </SeloStatus>
        </div>
      )}
    </li>
  );
}
