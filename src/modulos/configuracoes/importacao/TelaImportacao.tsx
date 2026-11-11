import { FileUp, Upload } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import type { ResultadoImportacao } from "@/integracoes";
import { useSessao } from "@/modulos/sessao/sessao";
import { lerCsv, montarLinhas, sugerirMapeamento, type TipoImportacao } from "@/regras";
import { baixarErros, lerArquivo, useImportar } from "./dados";
import { Historico } from "./Historico";
import { ListaErros, Mapeamento } from "./Mapeamento";

const TIPOS: { valor: TipoImportacao; rotulo: string }[] = [
  { valor: "clientes", rotulo: "Clientes" },
  { valor: "vendas", rotulo: "Vendas faturadas" },
  { valor: "orcamentos", rotulo: "Orçamentos" },
];

export function TelaImportacao() {
  const id = useId();
  const { data: sessao } = useSessao();
  const [empresa, setEmpresa] = useState("");
  const [tipo, setTipo] = useState<TipoImportacao>("clientes");
  const [arquivo, setArquivo] = useState<{ nome: string; dados: string[][] } | null>(null);
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const importar = useImportar();

  const previa = useMemo(
    () => (arquivo ? montarLinhas(tipo, arquivo.dados.slice(1), mapa) : null),
    [arquivo, tipo, mapa],
  );

  if (!sessao?.papeis.includes("diretoria"))
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Importar planilhas do Shop9</h1>
        <EstadoVazio icone={FileUp} titulo="Só a diretoria importa planilhas">
          A importação muda as carteiras e as vendas de todo o time. Peça à diretoria.
        </EstadoVazio>
      </div>
    );

  async function escolher(f: File | undefined) {
    setResultado(null);
    setErroArquivo(null);
    if (!f) return setArquivo(null);
    if (!/\.csv$/i.test(f.name))
      return setErroArquivo(
        "Use um arquivo .csv. No Excel: Arquivo → Salvar como → CSV (separado por ponto e vírgula).",
      );
    const dados = lerCsv(await lerArquivo(f));
    if (dados.length < 2) return setErroArquivo("A planilha está vazia ou só tem o cabeçalho.");
    setArquivo({ nome: f.name, dados });
    setMapa(sugerirMapeamento(tipo, dados[0]!));
  }

  function trocarTipo(t: TipoImportacao) {
    setTipo(t);
    setResultado(null);
    if (arquivo) setMapa(sugerirMapeamento(t, arquivo.dados[0]!));
  }

  async function confirmar() {
    if (!arquivo || !previa || !empresa) return;
    try {
      setResultado(
        await importar.mutateAsync({
          tipo,
          empresaId: empresa,
          arquivo: arquivo.nome,
          linhas: previa.linhas,
        }),
      );
    } catch (e) {
      setErroArquivo(`A importação não foi gravada: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Importar planilhas do Shop9</h1>

      <section aria-labelledby={`${id}-p1`} className="cartao grid gap-4 p-5">
        <h2 id={`${id}-p1`} className="text-lg font-bold">
          1. Empresa, tipo e arquivo
        </h2>
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor={`${id}-empresa`}>Empresa</Label>
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger id={`${id}-empresa`} className="min-h-11">
              <SelectValue placeholder="Escolha a empresa" />
            </SelectTrigger>
            <SelectContent>
              {sessao.empresas.map((e) => (
                <SelectItem key={e.id} value={e.id} className="min-h-11">
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <fieldset>
          <legend className="mb-2 font-semibold">O que a planilha traz</legend>
          <RadioGroup
            value={tipo}
            onValueChange={(v) => trocarTipo(v as TipoImportacao)}
            className="flex flex-wrap gap-2"
          >
            {TIPOS.map((t) => (
              <Label
                key={t.valor}
                htmlFor={`${id}-${t.valor}`}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 font-normal has-[:checked]:border-primary"
              >
                <RadioGroupItem id={`${id}-${t.valor}`} value={t.valor} />
                {t.rotulo}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-arquivo`}>Arquivo CSV exportado do Shop9</Label>
          <Input
            id={`${id}-arquivo`}
            type="file"
            accept=".csv,text/csv"
            className="min-h-11"
            onChange={(e) => escolher(e.target.files?.[0])}
            aria-describedby={erroArquivo ? `${id}-erro` : undefined}
          />
          <p className="text-sm text-muted-foreground">
            Importe primeiro os clientes; vendas e orçamentos usam o código do cliente.
          </p>
        </div>
        {erroArquivo && (
          <p id={`${id}-erro`} role="alert" className="font-semibold text-perigo">
            {erroArquivo}
          </p>
        )}
      </section>

      {arquivo && previa && (
        <section aria-labelledby={`${id}-p2`} className="cartao grid gap-5 p-5">
          <h2 id={`${id}-p2`} className="text-lg font-bold">
            2. Colunas e prévia
          </h2>
          <Mapeamento tipo={tipo} cabecalho={arquivo.dados[0]!} mapa={mapa} aoMudar={setMapa} />
          <p role="status" className="font-semibold">
            {previa.linhas.length} {tipo === "vendas" ? "notas" : "linhas"} prontas para gravar;{" "}
            {previa.erros.length} com erro (não serão gravadas).
          </p>
          <ListaErros erros={previa.erros} titulo="Linhas com erro na planilha" />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={confirmar}
              disabled={!empresa || !previa.linhas.length || importar.isPending}
            >
              <Upload aria-hidden="true" />{" "}
              {importar.isPending ? "Gravando…" : `Gravar ${previa.linhas.length} no sistema`}
            </Button>
            {previa.erros.length > 0 && (
              <Button variant="outline" onClick={() => baixarErros(arquivo.nome, previa.erros)}>
                Baixar erros da planilha
              </Button>
            )}
          </div>
          {!empresa && (
            <p className="text-sm text-muted-foreground">Escolha a empresa para poder gravar.</p>
          )}
        </section>
      )}

      {resultado && (
        <section aria-labelledby={`${id}-p3`} className="cartao grid gap-4 p-5">
          <h2 id={`${id}-p3`} className="text-lg font-bold">
            3. Resultado
          </h2>
          <p role="status">
            {resultado.inseridas} novos, {resultado.atualizadas} atualizados e {resultado.ignoradas}{" "}
            recusados pelo sistema. A importação ficou registrada no histórico.
          </p>
          <ListaErros erros={resultado.erros} titulo="Recusados pelo sistema" />
          {resultado.erros.length > 0 && (
            <Button
              variant="outline"
              className="justify-self-start"
              onClick={() => baixarErros(arquivo?.nome ?? "importacao", resultado.erros)}
            >
              Baixar relatório de erros
            </Button>
          )}
        </section>
      )}

      <Historico />
    </div>
  );
}
