import { CalendarOff, CalendarPlus, Copy, Info, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnunciar } from "@/design-system/Anunciador";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { useSessao } from "@/modulos/sessao/sessao";
import { hojeEmMaceio, paraData } from "@/regras";
import {
  ABRANGENCIAS,
  explicarErro,
  useCopiarParaAno,
  useExcluirFeriado,
  useFeriados,
  useRestaurarFeriado,
  type Feriado,
} from "./dados";
import { FormFeriado } from "./FormFeriado";

const dataLonga = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "long",
});
const rotulo = (a: Feriado["abrangencia"]) => ABRANGENCIAS.find((x) => x.valor === a)?.rotulo ?? a;

export function TelaFeriados() {
  const { data: sessao, isLoading: carregandoSessao } = useSessao();
  const anoAtual = hojeEmMaceio().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [form, setForm] = useState<{ aberto: boolean; feriado: Feriado | null }>({
    aberto: false,
    feriado: null,
  });
  const consulta = useFeriados(ano);
  const excluir = useExcluirFeriado();
  const restaurar = useRestaurarFeriado();
  const copiar = useCopiarParaAno();
  const anunciar = useAnunciar();

  if (carregandoSessao) return <Skeleton className="h-40 rounded-xl" aria-label="Carregando" />;
  if (!sessao?.papeis.includes("diretoria"))
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Feriados e dias sem expediente</h1>
        <EstadoVazio icone={CalendarOff} titulo="Só a diretoria edita o calendário">
          Os feriados mudam metas e prazos de todo o time. Se uma data estiver faltando, avise a
          diretoria.
        </EstadoVazio>
      </div>
    );

  const empresas = sessao.empresas;
  const nomeEmpresa = (id: string | null) =>
    id ? `Só ${empresas.find((e) => e.id === id)?.nome ?? "uma empresa"}` : "Todas as empresas";
  const avisar = (msg: string) => {
    toast.success(msg);
    anunciar(msg);
  };

  async function apagar(f: Feriado) {
    try {
      await excluir.mutateAsync(f.id);
      toast(`${f.nome} excluído.`, {
        action: {
          label: "Desfazer",
          onClick: () => restaurar.mutate(f, { onSuccess: () => avisar(`${f.nome} restaurado.`) }),
        },
      });
      anunciar(`${f.nome} excluído. Use Desfazer para restaurar.`);
    } catch (err) {
      toast.error(explicarErro(err));
    }
  }

  async function copiarAno() {
    try {
      const r = await copiar.mutateAsync(ano);
      avisar(
        `${r.copiados} ${r.copiados === 1 ? "data copiada" : "datas copiadas"} para ${ano + 1}. ${r.ja_existiam} já existiam; ${r.ignorados_moveis} móveis ficaram de fora.`,
      );
    } catch (err) {
      toast.error(explicarErro(err));
    }
  }

  const lista = consulta.data ?? [];
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Feriados e dias sem expediente</h1>

      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Estas datas mudam metas e prazos</AlertTitle>
        <AlertDescription>
          Cada data aqui deixa de contar como dia útil. A partir dela mudam a meta do dia, a
          projeção do mês e o prazo de orçamento parado de todo o time.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ano-feriados">Ano</Label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger id="ano-feriados" className="min-h-11 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((a) => (
                <SelectItem key={a} value={String(a)} className="min-h-11">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setForm({ aberto: true, feriado: null })}>
          <CalendarPlus aria-hidden="true" /> Adicionar data
        </Button>
        <Button
          variant="outline"
          onClick={copiarAno}
          disabled={copiar.isPending || lista.length === 0}
        >
          <Copy aria-hidden="true" /> {copiar.isPending ? "Copiando…" : `Copiar para ${ano + 1}`}
        </Button>
      </div>

      <section aria-labelledby="lista-feriados" className="cartao p-5 sm:p-6">
        <h2 id="lista-feriados" className="mb-4 text-lg font-bold">
          Datas de {ano} {consulta.data && `(${lista.length})`}
        </h2>
        {consulta.isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando datas">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : consulta.error ? (
          <EstadoErro
            titulo={`Não foi possível carregar as datas de ${ano}.`}
            aoTentar={() => consulta.refetch()}
            tentando={consulta.isFetching}
          />
        ) : lista.length === 0 ? (
          <EstadoVazio icone={CalendarOff} titulo={`Nenhuma data em ${ano}`}>
            Adicione os feriados e os dias sem expediente deste ano, ou copie as datas fixas do ano
            anterior escolhendo {ano - 1} acima.
          </EstadoVazio>
        ) : (
          <ul className="cascata divide-y">
            {lista.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <time dateTime={f.data} className="numeros w-36 shrink-0 font-semibold capitalize">
                  {dataLonga.format(paraData(f.data))}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {rotulo(f.abrangencia)}
                    {f.localidade ? ` · ${f.localidade}` : ""} · {nomeEmpresa(f.empresa_id)}
                    {f.data_movel ? " · data móvel" : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setForm({ aberto: true, feriado: f })}
                    aria-label={`Editar ${f.nome}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => apagar(f)}
                    disabled={excluir.isPending}
                    aria-label={`Excluir ${f.nome}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FormFeriado
        aberto={form.aberto}
        inicial={form.feriado}
        empresas={empresas}
        aoFechar={() => setForm({ aberto: false, feriado: null })}
        aoSalvar={(f) => {
          setForm({ aberto: false, feriado: null });
          avisar(`${f.nome} salvo.`);
          const anoSalvo = Number(f.data.slice(0, 4));
          if (anoSalvo !== ano) setAno(anoSalvo);
        }}
      />
    </div>
  );
}
