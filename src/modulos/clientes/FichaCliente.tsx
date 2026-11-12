import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarPlus, ClipboardCheck, MessageCircle, UserX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { DETALHE_EXPANSAO } from "@/design-system/movimento";
import { SeloStatus, type TomStatus } from "@/design-system/SeloStatus";
import { formatarMoeda } from "@/design-system/formatar";
import { integracoes } from "@/integracoes";
import { RegistrarContato } from "@/modulos/contato/RegistrarContato";
import { useSessao } from "@/modulos/sessao/sessao";
import {
  hojeEmMaceio,
  interacaoQualificada,
  paraData,
  REGRAS_PADRAO,
  saudeCliente,
  clienteSemCompra,
  type SaudeCliente,
  type TipoInteracao,
} from "@/regras";
import { useFicha, useRegrasDaEmpresa } from "./dados";
import { EtiquetasCliente } from "./EtiquetasCliente";
import {
  Compras,
  InteracoesCliente,
  ItensMaisComprados,
  OrcamentosCliente,
} from "./HistoricoCliente";
import { NotasCliente } from "./NotasCliente";
import { RemanejarCliente } from "./RemanejarCliente";

const SAUDE: Record<SaudeCliente, { tom: TomStatus; rotulo: string }> = {
  saudavel: { tom: "sucesso", rotulo: "Saudável" },
  atencao: { tom: "atencao", rotulo: "Atenção" },
  em_risco: { tom: "perigo", rotulo: "Em risco" },
};
const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function FichaCliente({ clienteId }: { clienteId: string }) {
  const { data: sessao } = useSessao();
  const consulta = useFicha(clienteId);
  const ficha = consulta.data;
  const cfg = useRegrasDaEmpresa(ficha?.cliente.empresa_id).data ?? REGRAS_PADRAO;
  const [registrando, setRegistrando] = useState(false);
  const voltar = (
    <Link
      to="/clientes"
      className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Clientes
    </Link>
  );

  if (consulta.error && !ficha)
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <h1 className="text-2xl font-extrabold">Ficha do cliente</h1>
        <EstadoErro
          titulo="Não foi possível carregar a ficha."
          aoTentar={() => consulta.refetch()}
          tentando={consulta.isFetching}
        />
      </div>
    );
  if (consulta.isLoading)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {voltar}
        <h1 className="text-2xl font-extrabold">Ficha do cliente</h1>
        <p role="status" className="sr-only">
          Carregando ficha do cliente…
        </p>
        <Skeleton className="h-28 rounded-xl" style={DETALHE_EXPANSAO} />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  if (!ficha)
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <h1 className="text-2xl font-extrabold">Cliente não encontrado</h1>
        <EstadoVazio icone={UserX} titulo="Este cliente não está na sua carteira">
          Ele pode ter mudado de carteira ou o link está errado. Volte para a lista de clientes.
        </EstadoVazio>
      </div>
    );

  const c = ficha.cliente;
  const hoje = hojeEmMaceio();
  const ultimaQualificada =
    ficha.interacoes
      .filter((i) => interacaoQualificada({ ...i, tipo: i.tipo as TipoInteracao }))
      .map((i) => i.dia_local)
      .sort()
      .at(-1) ?? null;
  const saude =
    SAUDE[
      saudeCliente(
        {
          compras: ficha.compras.map((x) => x.data),
          ultima_interacao_qualificada: ultimaQualificada,
        },
        hoje,
        cfg,
      )
    ];
  const meuId = sessao?.usuario?.id ?? "";
  const ehDono = c.vendedor_id === meuId;
  const gestao = !!sessao?.papeis.some((p) => p === "supervisor" || p === "diretoria");

  return (
    <div className="flex flex-col gap-5">
      {voltar}
      <header className="cartao flex flex-col gap-3 p-5" style={DETALHE_EXPANSAO}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{c.nome}</h1>
          <SeloStatus tom={saude.tom}>{saude.rotulo}</SeloStatus>
        </div>
        <p className="text-muted-foreground">
          {[c.segmento, c.cidade, c.codigo_shop9 && `Código Shop9 ${c.codigo_shop9}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="flex flex-wrap gap-2">
          {c.telefone && (
            <Button asChild variant="outline">
              <a
                href={integracoes.mensagens.abrirConversa(c.telefone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" /> Abrir WhatsApp
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          )}
          {ehDono && (
            <Button asChild variant="outline">
              <Link to="/agenda" search={{ cliente: c.id }}>
                <CalendarPlus aria-hidden="true" /> Agendar
              </Link>
            </Button>
          )}
          {ehDono && (
            <Button onClick={() => setRegistrando(true)}>
              <ClipboardCheck aria-hidden="true" /> Registrar contato
            </Button>
          )}
        </div>
      </header>

      <section aria-label="Resumo de compras" className="cartao p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Comprado em 12 meses", formatarMoeda(Number(ficha.total_12m))],
            ["Compras em 12 meses", String(ficha.qtd_12m)],
            ["Ticket médio", formatarMoeda(Number(ficha.ticket_medio_12m))],
            [
              "Última compra",
              c.data_ultima_compra
                ? dataCurta.format(paraData(c.data_ultima_compra))
                : "Nunca comprou",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="numeros font-display text-lg font-bold break-words sm:text-xl">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <EtiquetasCliente clienteId={c.id} etiquetas={c.etiquetas ?? []} />
        <NotasCliente ficha={ficha} meuId={meuId} />
        <ItensMaisComprados ficha={ficha} />
        <OrcamentosCliente ficha={ficha} />
        <Compras ficha={ficha} />
        <InteracoesCliente ficha={ficha} />
      </div>

      {gestao &&
        (clienteSemCompra(c.data_ultima_compra, hoje, cfg) ? (
          <RemanejarCliente
            ficha={ficha}
            diasSemCompra={cfg.cliente_sem_compra_dias}
            meuId={meuId}
          />
        ) : (
          <p className="cartao p-5 text-muted-foreground">
            <strong className="text-foreground">Mudar de carteira:</strong> só para clientes sem
            compra há {cfg.cliente_sem_compra_dias} dias ou mais. Este cliente comprou mais
            recentemente.
          </p>
        ))}

      {ehDono && (
        <RegistrarContato
          cliente={{ id: c.id, nome: c.nome, empresa_id: c.empresa_id }}
          vendedorId={meuId}
          aberto={registrando}
          aoFechar={() => {
            setRegistrando(false);
            consulta.refetch();
          }}
        />
      )}
    </div>
  );
}
