import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CAMPOS, type ErroLinha, type LinhaImportacao, type TipoImportacao } from "@/regras";

const NENHUMA = "-1";

/** Uma escolha de coluna por campo, já sugerida pelo nome do cabeçalho. */
export function Mapeamento({
  tipo,
  cabecalho,
  mapa,
  aoMudar,
}: {
  tipo: TipoImportacao;
  cabecalho: string[];
  mapa: Record<string, number>;
  aoMudar: (m: Record<string, number>) => void;
}) {
  const id = useId();
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-2 font-semibold">
        Qual coluna da planilha corresponde a cada campo?
      </legend>
      {CAMPOS[tipo].map((c) => (
        <div key={c.chave} className="grid gap-1.5">
          <Label htmlFor={`${id}-${c.chave}`}>
            {c.rotulo}
            {c.obrigatorio ? " (obrigatório)" : ""}
          </Label>
          <Select
            value={String(mapa[c.chave] ?? -1)}
            onValueChange={(v) => aoMudar({ ...mapa, [c.chave]: Number(v) })}
          >
            <SelectTrigger id={`${id}-${c.chave}`} className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUMA} className="min-h-11">
                Não tem na planilha
              </SelectItem>
              {cabecalho.map((h, i) => (
                <SelectItem key={i} value={String(i)} className="min-h-11">
                  {h || `Coluna ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </fieldset>
  );
}

/** Lista de erros por linha, com no máximo 50 itens na tela. */
export function ListaErros({ erros, titulo }: { erros: ErroLinha[]; titulo: string }) {
  const id = useId();
  if (!erros.length) return null;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-2 font-bold text-perigo">
        {titulo} ({erros.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 font-semibold">
                Linha
              </th>
              <th scope="col" className="py-2 font-semibold">
                Campo
              </th>
              <th scope="col" className="py-2 font-semibold">
                O que corrigir
              </th>
            </tr>
          </thead>
          <tbody>
            {erros.slice(0, 50).map((e, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="numeros py-2">{e.linha}</td>
                <td className="py-2">{e.campo}</td>
                <td className="py-2">{e.mensagem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {erros.length > 50 && (
        <p className="mt-2 text-sm text-muted-foreground">
          E mais {erros.length - 50}. Baixe o relatório para ver todos.
        </p>
      )}
    </section>
  );
}

const ROTULOS: Record<string, string> = Object.fromEntries(
  Object.values(CAMPOS).flatMap((cs) => cs.map((c) => [c.chave, c.rotulo])),
);

/** As 5 primeiras linhas já convertidas (datas, valores, telefone), para conferir antes de gravar. */
export function Previa({ linhas }: { linhas: LinhaImportacao[] }) {
  const id = useId();
  if (!linhas.length) return null;
  const colunas = Object.keys(linhas[0]!).filter((k) => k !== "linha" && k !== "itens");
  const mostrar = (v: unknown) => (v === null || v === "" ? "—" : String(v));
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="mb-2 font-bold">
        Como vai ficar (primeiras {Math.min(5, linhas.length)})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Linha
              </th>
              {colunas.map((c) => (
                <th key={c} scope="col" className="py-2 pr-3 font-semibold">
                  {ROTULOS[c] ?? c}
                </th>
              ))}
              {"itens" in linhas[0]! && (
                <th scope="col" className="py-2 font-semibold">
                  Itens
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, 5).map((l) => (
              <tr key={l.linha} className="border-b last:border-0">
                <td className="numeros py-2 pr-3">{l.linha}</td>
                {colunas.map((c) => (
                  <td key={c} className="py-2 pr-3">
                    {mostrar(l[c])}
                  </td>
                ))}
                {"itens" in l && (
                  <td className="numeros py-2">{(l["itens"] as unknown[]).length}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
