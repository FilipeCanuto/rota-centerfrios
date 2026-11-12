import { Link } from "@tanstack/react-router";
import { CalendarPlus, FileText } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAnunciar } from "@/design-system/Anunciador";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { abrirExpansao, Contador, expansao, transicaoDeVisao } from "@/design-system/movimento";
import { formatarMoeda } from "@/design-system/formatar";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useEmpresasAtivas } from "@/modulos/sessao/sessao";
import { formatarISO, hojeEmMaceio, situacaoOrcamento } from "@/regras";
import { useOrcamentos, useRegistrarRetorno, type Orcamento, type StatusOrcamento } from "./dados";

const ABAS: { valor: StatusOrcamento; rotulo: string }[] = [
  { valor: "aberto", rotulo: "Abertos" },
  { valor: "ganho", rotulo: "Ganhos" },
  { valor: "perdido", rotulo: "Perdidos" },
];
const dia = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const data = (iso: string) => dia.format(new Date(`${iso.slice(0, 10)}T12:00:00`));

export function TelaOrcamentos() {
  const empresas = useEmpresasAtivas();
  const [aba, setAba] = useState<StatusOrcamento>("aberto");
  const [editando, setEditando] = useState<Orcamento | null>(null);
  const q = useOrcamentos(aba, empresas);
  const hojeData = hojeEmMaceio();
  const hoje = formatarISO(hojeData);

  const lista = (q.data?.orcamentos ?? []).map((o) => ({
    o,
    ...situacaoOrcamento(
      o,
      hoje,
      hojeData,
      q.data!.regras(o.empresa_id),
      q.data!.feriados(o.empresa_id),
    ),
  }));
  const total = lista.reduce((s, { o }) => s + Number(o.valor), 0);
  const parados = lista.filter((i) => i.parado).length;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Orçamentos</h1>
      <div role="group" aria-label="Situação do orçamento" className="flex flex-wrap gap-2">
        {ABAS.map((a) => (
          <Button
            key={a.valor}
            variant={aba === a.valor ? "default" : "outline"}
            aria-pressed={aba === a.valor}
            className="min-h-11"
            onClick={() => transicaoDeVisao(() => setAba(a.valor))}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <EstadoErro
          titulo="Não foi possível carregar os orçamentos."
          aoTentar={() => void q.refetch()}
          tentando={q.isFetching}
        />
      ) : lista.length === 0 ? (
        <EstadoVazio icone={FileText} titulo="Nenhum orçamento aqui">
          <p>
            Os orçamentos chegam pela importação do Shop9. Quando houver, eles aparecem nesta lista.
          </p>
        </EstadoVazio>
      ) : (
        <>
          <p className="text-muted-foreground" aria-live="polite">
            {lista.length} {lista.length === 1 ? "orçamento" : "orçamentos"} somando
            {lista.length === 200 ? " pelo menos " : " "}
            <Contador
              valor={total}
              formatar={formatarMoeda}
              className="numeros font-semibold text-foreground"
            />
            {aba === "aberto" && parados > 0 && ` · ${parados} parado${parados > 1 ? "s" : ""}`}
            {lista.length === 200 && " · mostrando os 200 mais recentes"}
          </p>
          <ul className="cartao cascata divide-y">
            {lista.map(({ o, parado, retornoAtrasado }) => (
              <li
                key={o.id}
                {...expansao(o.id)}
                className="linha-interativa flex flex-wrap items-center gap-x-3 gap-y-2 p-4"
              >
                <Link
                  to="/clientes/$id"
                  params={{ id: o.cliente_id }}
                  onClick={abrirExpansao(o.id)}
                  className="min-h-11 content-center font-semibold underline-offset-2 hover:underline"
                >
                  {o.clientes?.nome ?? "Cliente"}
                </Link>
                {parado && <SeloStatus tom="atencao">Parado</SeloStatus>}
                {retornoAtrasado && <SeloStatus tom="perigo">Retorno atrasado</SeloStatus>}
                <span className="numeros ml-auto font-semibold">
                  {formatarMoeda(Number(o.valor))}
                </span>
                <p className="w-full text-sm text-muted-foreground">
                  Feito em {data(o.data)}
                  {o.ultimo_followup && ` · último retorno ${data(o.ultimo_followup)}`}
                  {o.status === "aberto" &&
                    o.proximo_followup &&
                    ` · próximo retorno ${data(o.proximo_followup)}`}
                </p>
                {o.observacao && <p className="w-full text-sm">{o.observacao}</p>}
                {o.status === "aberto" && (
                  <div className="flex w-full flex-wrap gap-2">
                    <Button variant="outline" className="min-h-11" onClick={() => setEditando(o)}>
                      Registrar retorno
                    </Button>
                    <Button asChild variant="outline" className="min-h-11">
                      <Link to="/agenda" search={{ cliente: o.cliente_id }}>
                        <CalendarPlus aria-hidden="true" /> Agendar
                      </Link>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <FormRetorno orcamento={editando} hoje={hoje} aoFechar={() => setEditando(null)} />
    </div>
  );
}

function FormRetorno({
  orcamento,
  hoje,
  aoFechar,
}: {
  orcamento: Orcamento | null;
  hoje: string;
  aoFechar: () => void;
}) {
  // A chave refaz o formulário (e seus campos) a cada orçamento aberto.
  return (
    <Sheet open={!!orcamento} onOpenChange={(a) => !a && aoFechar()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-2xl overflow-y-auto rounded-t-xl"
      >
        {orcamento && (
          <Corpo key={orcamento.id} orcamento={orcamento} hoje={hoje} aoFechar={aoFechar} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Corpo({
  orcamento,
  hoje,
  aoFechar,
}: {
  orcamento: Orcamento;
  hoje: string;
  aoFechar: () => void;
}) {
  const id = useId();
  const anunciar = useAnunciar();
  const registrar = useRegistrarRetorno();
  const [proximo, setProximo] = useState(orcamento.proximo_followup ?? "");
  const [obs, setObs] = useState(orcamento.observacao ?? "");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (proximo && proximo < hoje) return setErro("O próximo retorno não pode ser no passado.");
    setErro(null);
    try {
      await registrar.mutateAsync({
        id: orcamento.id,
        hoje,
        proximo_followup: proximo || null,
        observacao: obs.trim() || null,
      });
    } catch {
      return setErro("Não foi possível salvar o retorno. Tente de novo.");
    }
    toast.success("Retorno registrado.");
    anunciar("Retorno registrado.");
    aoFechar();
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display text-xl">Registrar retorno</SheetTitle>
        <SheetDescription>
          {orcamento.clientes?.nome} · {formatarMoeda(Number(orcamento.valor))}. Salvar marca o
          retorno de hoje.
        </SheetDescription>
      </SheetHeader>
      <form onSubmit={enviar} className="mt-4 flex flex-col gap-5" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-prox`}>Próximo retorno (opcional)</Label>
          <Input
            id={`${id}-prox`}
            type="date"
            min={hoje}
            className="min-h-11"
            value={proximo}
            aria-invalid={!!erro}
            onChange={(e) => setProximo(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-obs`}>Observação (opcional)</Label>
          <Textarea
            id={`${id}-obs`}
            maxLength={500}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </div>
        {erro && (
          <p role="alert" className="font-semibold text-perigo">
            {erro}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={registrar.isPending}>
            {registrar.isPending ? "Salvando…" : "Salvar retorno"}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={aoFechar}>
            Cancelar
          </Button>
        </div>
      </form>
    </>
  );
}
