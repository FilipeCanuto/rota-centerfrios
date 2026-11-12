import { Award, Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Contador, transicaoDeVisao } from "@/design-system/movimento";
import { EstadoErro } from "@/design-system/EstadoErro";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useEmpresasAtivas, useSessao } from "@/modulos/sessao/sessao";
import { formatarISO, hojeEmMaceio, INDICADORES, periodoMes, periodoSemana } from "@/regras";
import { useMeusPontos, useRanking } from "./dados";
import { AjustesGamificacao } from "./Ajustes";
import { InstagramPosts } from "./Instagram";

const dia = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function TelaGamificacao() {
  const { data: sessao } = useSessao();
  const empresas = useEmpresasAtivas();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Pontos e selos</h1>
      {empresas.map((id) => (
        <SecaoEmpresa
          key={id}
          empresaId={id}
          nome={empresas.length > 1 ? sessao?.empresas.find((e) => e.id === id)?.nome : undefined}
        />
      ))}
    </div>
  );
}

function SecaoEmpresa({ empresaId, nome }: { empresaId: string; nome?: string | undefined }) {
  const { data: sessao } = useSessao();
  const papeis = sessao?.papeis ?? [];
  const hoje = formatarISO(hojeEmMaceio());
  const [inicioMes, fimMes] = periodoMes(hoje);
  const ehVendedor = papeis.includes("vendedor");
  const meus = useMeusPontos(
    empresaId,
    ehVendedor ? sessao?.usuario?.id : undefined,
    hoje,
    inicioMes,
    fimMes,
  );
  return (
    <section className="flex flex-col gap-5" aria-label={nome ?? "Pontos"}>
      {nome && <h2 className="text-xl font-bold">{nome}</h2>}
      {ehVendedor && meus.data !== null && (
        <div className="cartao p-5">
          <h3 className="mb-3 text-lg font-bold">Meus pontos no mês</h3>
          {meus.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : meus.isError ? (
            <EstadoErro
              titulo="Não foi possível carregar seus pontos."
              aoTentar={() => void meus.refetch()}
              tentando={meus.isFetching}
            />
          ) : !meus.data ? null : (
            <>
              <p className="numeros text-4xl font-extrabold">
                <Contador valor={meus.data.totalMes} />{" "}
                <span className="text-lg font-semibold">pontos</span>
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {Object.entries(INDICADORES).map(([k, rotulo]) => (
                  <div key={k}>
                    <dt className="text-sm text-muted-foreground">{rotulo}</dt>
                    <dd className="numeros font-semibold">
                      {meus.data?.porIndicador[k] ?? 0}
                      {(meus.data?.hoje[k] ?? 0) > 0 && ` (+${meus.data?.hoje[k]} hoje)`}
                    </dd>
                  </div>
                ))}
              </dl>
              <h4 className="mb-2 mt-5 font-semibold">Selos</h4>
              {meus.data.selos.length === 0 ? (
                <p className="text-muted-foreground">
                  Nenhum selo ainda. Cumpra as metas para conquistar o primeiro.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {meus.data.selos.map((s) => (
                    <li key={s.id} className="pulsar flex flex-wrap items-center gap-2">
                      <SeloStatus tom="conquista">{s.nome}</SeloStatus>
                      <span className="text-sm text-muted-foreground">
                        {dia.format(new Date(`${s.conquistado_em.slice(0, 10)}T12:00:00`))}
                        {s.descricao && ` · ${s.descricao}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      <Ranking empresaId={empresaId} hoje={hoje} />
      <InstagramPosts empresaId={empresaId} />
      {papeis.includes("diretoria") && <AjustesGamificacao empresaId={empresaId} />}
    </section>
  );
}

function Ranking({ empresaId, hoje }: { empresaId: string; hoje: string }) {
  const [semana, setSemana] = useState(false);
  const [inicio, fim] = semana ? periodoSemana(hoje) : periodoMes(hoje);
  const q = useRanking(empresaId, inicio, fim);
  return (
    <div className="cartao p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Trophy className="size-5" aria-hidden="true" /> Ranking
        </h3>
        <div role="group" aria-label="Período do ranking" className="ml-auto flex gap-2">
          {[
            { v: false, r: "Mês" },
            { v: true, r: "Semana" },
          ].map((o) => (
            <Button
              key={o.r}
              variant={semana === o.v ? "default" : "outline"}
              aria-pressed={semana === o.v}
              className="min-h-11"
              onClick={() => transicaoDeVisao(() => setSemana(o.v))}
            >
              {o.r}
            </Button>
          ))}
        </div>
      </div>
      {q.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : q.isError ? (
        <EstadoErro
          titulo="Não foi possível carregar o ranking."
          aoTentar={() => void q.refetch()}
          tentando={q.isFetching}
        />
      ) : q.data.length === 0 ? (
        <p className="text-muted-foreground">Ainda não há pontos neste período.</p>
      ) : (
        <ol className="cascata divide-y">
          {q.data.map((l) => (
            <li key={l.vendedor_id} className="flex items-center gap-3 py-2">
              <span className="numeros w-8 font-bold">{l.posicao}º</span>
              <span className={l.eh_voce ? "font-bold" : ""}>
                {l.nome}
                {l.eh_voce && " (você)"}
              </span>
              {l.posicao === 1 && l.pontos > 0 && (
                <Award className="size-4 text-primary" role="img" aria-label="Primeiro lugar" />
              )}
              <span className="numeros ml-auto font-semibold">{l.pontos} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
