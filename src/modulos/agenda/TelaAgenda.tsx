import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { supabase } from "@/integrations/supabase/client";
import { usePainel } from "@/modulos/inicio/dados";
import { useEmpresasAtivas, useSessao } from "@/modulos/sessao/sessao";
import { formatarISO, hojeEmMaceio, paraData } from "@/regras";
import { useGerarTarefasDosAlertas, useTarefas, type NovaTarefa, type Tarefa } from "./dados";
import { FormTarefa } from "./FormTarefa";
import { ItemTarefa } from "./ItemTarefa";

type Modo = "dia" | "semana" | "lista";
const diaLongo = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const somarDias = (iso: string, n: number) => {
  const d = paraData(iso);
  d.setDate(d.getDate() + n);
  return formatarISO(d);
};
/** Segunda-feira da semana da data. */
const inicioSemana = (iso: string) => somarDias(iso, -((paraData(iso).getDay() + 6) % 7));

export function TelaAgenda({
  novoPara,
  aoUsarNovoPara,
}: {
  /** Id do cliente vindo do "Agendar" do plano do dia ou da ficha. */
  novoPara?: string | undefined;
  aoUsarNovoPara?: () => void;
}) {
  const id = useId();
  const { data: sessao } = useSessao();
  const empresas = useEmpresasAtivas();
  const eu = sessao?.usuario?.id;
  const hoje = formatarISO(hojeEmMaceio());
  const [modo, setModo] = useState<Modo>("dia");
  const [base, setBase] = useState(hoje);
  const [form, setForm] = useState<(NovaTarefa & { nomeCliente?: string | undefined }) | null>(
    null,
  );

  const [inicio, fim] =
    modo === "dia"
      ? [base, base]
      : modo === "semana"
        ? [inicioSemana(base), somarDias(inicioSemana(base), 6)]
        : [hoje, somarDias(hoje, 29)];
  // Atrasadas só na lista e no dia de hoje: em outro dia elas confundiriam.
  const tarefas = useTarefas(
    eu,
    inicio,
    fim,
    modo === "lista" || (modo === "dia" && base === hoje),
  );

  // Tarefas automáticas: o plano do dia vira retornos na agenda (o banco não duplica).
  const painel = usePainel(eu, empresas).data;
  const gerar = useGerarTarefasDosAlertas(eu);
  const chavePlano = painel?.plano.map((i) => i.cliente.id).join(",");
  useEffect(() => {
    if (!painel?.plano.length) return;
    gerar.mutate(
      painel.plano.map((i) => ({
        empresa_id: i.cliente.empresa_id,
        cliente_id: i.cliente.id,
        motivo_alerta: i.tipo,
        titulo: i.motivo,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o plano muda
  }, [chavePlano]);

  // Vindo do plano do dia ou da ficha ("Agendar"): abre o formulário com o cliente, para amanhã
  // (o retorno de hoje já entra sozinho pelo plano do dia).
  useEffect(() => {
    if (!novoPara || !eu) return;
    let ativo = true;
    void supabase
      .from("clientes")
      .select("nome,empresa_id")
      .eq("id", novoPara)
      .maybeSingle()
      .then(({ data: c }) => {
        if (!ativo) return;
        aoUsarNovoPara?.();
        if (!c) return void toast.error("Cliente não encontrado.");
        setForm(
          nova({
            cliente_id: novoPara,
            empresa_id: c.empresa_id,
            nomeCliente: c.nome,
            titulo: `Retornar para ${c.nome}`,
            data: somarDias(hoje, 1),
          }),
        );
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por chegada
  }, [novoPara, eu]);

  function nova(
    p: Partial<NovaTarefa> & { nomeCliente?: string },
  ): NovaTarefa & { nomeCliente?: string | undefined } {
    return {
      empresa_id: empresas[0] ?? "",
      vendedor_id: eu ?? "",
      cliente_id: null,
      titulo: "",
      data: base,
      hora: null,
      tipo: "retorno",
      observacao: null,
      ...p,
    };
  }
  const editar = (t: Tarefa) =>
    setForm({
      id: t.id,
      empresa_id: t.empresa_id,
      vendedor_id: eu ?? "",
      cliente_id: t.cliente_id,
      titulo: t.titulo,
      data: t.data,
      hora: t.hora,
      tipo: t.tipo,
      observacao: t.observacao,
      nomeCliente: t.clientes?.nome,
    });

  const titulo =
    modo === "dia"
      ? diaLongo.format(paraData(base))
      : modo === "semana"
        ? `Semana de ${diaLongo.format(paraData(inicio))}`
        : "Próximos 30 dias e atrasadas";
  const porDia = new Map<string, Tarefa[]>();
  for (const t of tarefas.data ?? []) porDia.set(t.data, [...(porDia.get(t.data) ?? []), t]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Agenda</h1>
        <Button onClick={() => setForm(nova({}))} disabled={!eu}>
          <Plus aria-hidden="true" /> Nova tarefa
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Botões com aria-pressed: as abas do Radix exigem painéis que esta tela não tem. */}
        <div
          role="group"
          aria-label="Visão da agenda"
          className="flex gap-1 rounded-lg bg-muted p-1"
        >
          {(["dia", "semana", "lista"] as const).map((m) => (
            <Button
              key={m}
              variant={modo === m ? "default" : "ghost"}
              aria-pressed={modo === m}
              onClick={() => setModo(m)}
            >
              {m === "dia" ? "Dia" : m === "semana" ? "Semana" : "Lista"}
            </Button>
          ))}
        </div>
        {modo !== "lista" && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={modo === "dia" ? "Dia anterior" : "Semana anterior"}
              onClick={() => setBase(somarDias(base, modo === "dia" ? -1 : -7))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" onClick={() => setBase(hoje)}>
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={modo === "dia" ? "Próximo dia" : "Próxima semana"}
              onClick={() => setBase(somarDias(base, modo === "dia" ? 1 : 7))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <section aria-labelledby={`${id}-t`} aria-busy={tarefas.isFetching}>
        <h2 id={`${id}-t`} className="mb-3 text-lg font-bold first-letter:uppercase">
          {titulo}
        </h2>
        {tarefas.error && !tarefas.data ? (
          <EstadoErro
            titulo="Não foi possível carregar a agenda."
            aoTentar={() => tarefas.refetch()}
            tentando={tarefas.isFetching}
          />
        ) : !tarefas.data ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">Carregando agenda…</span>
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ) : tarefas.data.length === 0 ? (
          <EstadoVazio icone={CalendarDays} titulo="Nada agendado">
            Os retornos do plano do dia entram aqui sozinhos. Use “Nova tarefa” para marcar visitas
            e ligações.
          </EstadoVazio>
        ) : (
          <div className="flex flex-col gap-4">
            {[...porDia.entries()].map(([dia, lista]) => (
              <div key={dia} className="cartao px-4">
                {(modo !== "dia" || dia !== base) && (
                  <h3 className="pt-3 font-semibold first-letter:uppercase">
                    <time dateTime={dia}>{diaLongo.format(paraData(dia))}</time>
                  </h3>
                )}
                <ul className="divide-y">
                  {lista.map((t) => (
                    <ItemTarefa
                      key={t.id}
                      tarefa={t}
                      atrasada={t.data < hoje}
                      aoEditar={() => editar(t)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {form && (
        <FormTarefa
          aberto
          inicial={form}
          aoFechar={() => setForm(null)}
          aoSalvar={(t) => {
            setForm(null);
            toast.success(`Tarefa "${t.titulo}" salva.`);
            if (modo === "dia") setBase(t.data);
          }}
        />
      )}
    </div>
  );
}
