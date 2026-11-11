import { Link } from "@tanstack/react-router";
import { CalendarPlus, ClipboardCheck, MessageCircle, Sparkles, UserX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { GraficoAnel } from "@/design-system/GraficoAnel";
import { Pinguim } from "@/design-system/Pinguim";
import { Progresso } from "@/design-system/Progresso";
import { SeloStatus, type TomStatus } from "@/design-system/SeloStatus";
import { formatarDataLonga, formatarMoeda, formatarPercentual } from "@/design-system/formatar";
import { integracoes } from "@/integracoes";
import { RegistrarContato, type ClienteContato } from "@/modulos/contato/RegistrarContato";
import { useEmpresasAtivas, useSessao } from "@/modulos/sessao/sessao";
import { formatarISO, hojeEmMaceio, type MotivoTipo, type Painel } from "@/regras";
import { usePainel } from "./dados";

const TOM: Record<MotivoTipo, { tom: TomStatus; rotulo: string }> = {
  recompra_urgente: { tom: "perigo", rotulo: "Urgente" },
  orcamento_parado: { tom: "atencao", rotulo: "Orçamento parado" },
  esquecido: { tom: "atencao", rotulo: "Esquecido" },
  recompra_atencao: { tom: "atencao", rotulo: "Atenção" },
  sem_compra: { tom: "info", rotulo: "Reativar" },
};

function Secao({
  id,
  titulo,
  children,
  className = "",
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-t`}
      id={id}
      className={`cartao entrada scroll-mt-20 p-5 sm:p-6 ${className}`}
    >
      <h2 id={`${id}-t`} className="mb-4 text-lg font-bold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function PainelInicio() {
  const { data: sessao, isLoading: carregandoSessao } = useSessao();
  const ativas = useEmpresasAtivas();
  const usuario = sessao?.usuario;
  const { data: p, error, refetch, isFetching } = usePainel(usuario?.id, ativas);
  const [contato, setContato] = useState<ClienteContato | null>(null);
  const hoje = hojeEmMaceio();

  if (!carregandoSessao && !usuario)
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Início</h1>
        <EstadoVazio icone={UserX} titulo="Seu cadastro ainda não está completo">
          Seu acesso ainda não está ligado a um cadastro da equipe. Fale com o administrador.
        </EstadoVazio>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm capitalize text-muted-foreground">
          <time dateTime={formatarISO(hoje)}>{formatarDataLonga(hoje)}</time>
        </p>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Olá, {usuario?.nome ?? "…"}</h1>
      </div>

      {error && !p ? (
        <EstadoErro
          titulo="Não foi possível carregar o painel."
          aoTentar={() => refetch()}
          tentando={isFetching}
        />
      ) : !p || !usuario ? (
        <Carregando />
      ) : (
        <>
          <Copiloto apelido={usuario.apelido_copiloto} p={p} />
          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <MetaMes p={p} />
            <Cobertura p={p} />
          </div>
          <MetasDoDia p={p} />
          <PlanoDoDia p={p} aoRegistrar={setContato} />
          <Alertas p={p} />
          <RegistrarContato
            cliente={contato}
            vendedorId={usuario.id}
            aberto={!!contato}
            aoFechar={() => setContato(null)}
          />
        </>
      )}
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando painel">
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

function Copiloto({ apelido, p }: { apelido: string; p: Painel }) {
  const msg = integracoes.copiloto.mensagemDoDia({
    apelido,
    clientesHoje: p.plano.length,
    orcamentosParados: p.orcamentosParados,
    atingimento: p.atingimento,
  });
  return (
    <section aria-label="Copiloto" className="cartao entrada flex items-center gap-4 p-5">
      <Pinguim className="size-14 shrink-0 text-foreground" />
      <p className="font-display text-lg font-semibold leading-snug">{msg}</p>
    </section>
  );
}

function MetaMes({ p }: { p: Painel }) {
  if (p.meta.meta_vendas <= 0)
    return (
      <Secao id="meta" titulo="Meta do mês">
        <p className="text-muted-foreground">Nenhuma meta cadastrada para este mês.</p>
      </Secao>
    );
  const resumo = `${formatarPercentual(p.atingimento)} da meta de ${formatarMoeda(p.meta.meta_vendas)} atingidos. Faltam ${formatarMoeda(p.falta)}.`;
  return (
    <Secao id="meta" titulo="Meta do mês">
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <GraficoAnel
          valor={p.atingimento}
          rotulo="Atingimento da meta do mês"
          resumo={resumo}
          tabela={[
            { indicador: "Meta do mês", valor: formatarMoeda(p.meta.meta_vendas) },
            { indicador: "Faturado", valor: formatarMoeda(p.faturadoMes) },
            { indicador: "Falta", valor: formatarMoeda(p.falta) },
            { indicador: "Projeção", valor: formatarMoeda(p.projecao) },
            { indicador: "Meta do dia", valor: formatarMoeda(p.metaDoDia) },
          ]}
        />
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            {[
              ["Faturado", formatarMoeda(p.faturadoMes)],
              ["Falta", formatarMoeda(p.falta)],
              ["Projeção", formatarMoeda(p.projecao)],
              ["Meta do dia", formatarMoeda(p.metaDoDia)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="numeros font-display text-xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            {p.atingimento >= 1 ? (
              <SeloStatus tom="conquista">Meta atingida</SeloStatus>
            ) : p.projecao >= p.meta.meta_vendas ? (
              <SeloStatus tom="sucesso">No ritmo da meta</SeloStatus>
            ) : (
              <SeloStatus tom="atencao">Abaixo do ritmo</SeloStatus>
            )}
          </div>
        </div>
      </div>
    </Secao>
  );
}

function Cobertura({ p }: { p: Painel }) {
  const c = p.cobertura;
  return (
    <Secao id="cobertura" titulo="Cobertura da carteira">
      <GraficoAnel
        tamanho="pequeno"
        valor={c.percentual}
        rotulo="Cobertura da carteira"
        resumo={`${c.cobertos} de ${c.total} clientes com contato qualificado ou compra no mês. Meta: ${p.meta.meta_cobertura}%.`}
        tabela={[
          { indicador: "Clientes cobertos", valor: String(c.cobertos) },
          { indicador: "Clientes na carteira", valor: String(c.total) },
          { indicador: "Cobertura", valor: formatarPercentual(c.percentual) },
          { indicador: "Meta de cobertura", valor: `${p.meta.meta_cobertura}%` },
        ]}
      />
    </Secao>
  );
}

function MetasDoDia({ p }: { p: Painel }) {
  return (
    <Secao id="metas-dia" titulo="Metas do dia">
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {p.metasDoDia.map((m) => {
          const fmt = (v: number) => (m.moeda ? formatarMoeda(v) : String(Math.round(v)));
          const prog = m.alvo > 0 ? m.atual / m.alvo : 0;
          return (
            <li key={m.chave} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{m.nome}</span>
                <span className="numeros text-sm text-muted-foreground">
                  {fmt(m.atual)} / {fmt(m.alvo)}
                </span>
              </div>
              <Progresso valor={prog} rotulo={`${m.nome}: ${fmt(m.atual)} de ${fmt(m.alvo)}`} />
              {prog >= 1 && <SeloStatus tom="sucesso">Concluída</SeloStatus>}
            </li>
          );
        })}
      </ul>
      <p className="mt-5 flex items-center gap-2 text-sm">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <span>
          <strong className="numeros">{p.pontosHoje}</strong> pontos ganhos hoje
        </span>
      </p>
    </Secao>
  );
}

function PlanoDoDia({ p, aoRegistrar }: { p: Painel; aoRegistrar: (c: ClienteContato) => void }) {
  return (
    <Secao id="plano" titulo={`Plano do dia (${p.plano.length})`}>
      {p.plano.length === 0 ? (
        <p className="text-muted-foreground">Nenhum cliente pendente hoje. Bom trabalho!</p>
      ) : (
        <ol className="divide-y">
          {p.plano.map((item, i) => (
            <li
              key={item.cliente.id}
              className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex min-w-0 gap-3">
                <span
                  className="numeros mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary-suave text-sm font-bold text-primary"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.cliente.nome}</h3>
                    <SeloStatus tom={TOM[item.tipo].tom}>{TOM[item.tipo].rotulo}</SeloStatus>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.motivo}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {item.cliente.telefone && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={integracoes.mensagens.abrirConversa(item.cliente.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle aria-hidden="true" /> Abrir WhatsApp
                      <span className="sr-only"> de {item.cliente.nome} (abre em nova aba)</span>
                    </a>
                  </Button>
                )}
                <Button size="sm" onClick={() => aoRegistrar(item.cliente)}>
                  <ClipboardCheck aria-hidden="true" /> Registrar contato
                  <span className="sr-only"> com {item.cliente.nome}</span>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to="/agenda"
                    search={{
                      cliente: item.cliente.id,
                      nome: item.cliente.nome,
                      empresa: item.cliente.empresa_id,
                    }}
                  >
                    <CalendarPlus aria-hidden="true" /> Agendar
                    <span className="sr-only"> {item.cliente.nome}</span>
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}

function Alertas({ p }: { p: Painel }) {
  return (
    <Secao id="alertas" titulo={`Alertas do dia (${p.alertas.length})`}>
      {p.alertas.length === 0 ? (
        <p className="text-muted-foreground">Sem alertas hoje.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {p.alertas.slice(0, 12).map((a) => (
            <li key={a.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
              <SeloStatus tom={TOM[a.tipo].tom}>{TOM[a.tipo].rotulo}</SeloStatus>
              <p className="font-semibold">{a.titulo}</p>
              <p className="text-sm text-muted-foreground">{a.detalhe}</p>
            </li>
          ))}
        </ul>
      )}
      {p.alertas.length > 12 && (
        <p className="mt-3 text-sm text-muted-foreground">
          E mais {p.alertas.length - 12} alertas.
        </p>
      )}
    </Secao>
  );
}
