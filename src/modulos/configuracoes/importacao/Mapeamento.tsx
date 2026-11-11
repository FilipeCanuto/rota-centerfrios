import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CAMPOS, type ErroLinha, type TipoImportacao } from "@/regras";

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
