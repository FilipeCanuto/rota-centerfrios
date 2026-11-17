import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAnunciar } from "@/design-system/Anunciador";
import { SeloStatus } from "@/design-system/SeloStatus";
import { useMapearVendedor, useSalvarEmpresaShop9, type EmpresaShop9 } from "./integracoesShop9";

const campo = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

const CAMPOS = [
  ["codfilial", "Código da filial no Shop9", "Ex.: 1"],
  [
    "codigo_operacao_orcamento",
    "Código da operação de orçamento",
    "Confirmar com a Idealsoft (ORC/DAV)",
  ],
  ["tipo_operacao_orcamento", "Sigla da operação de orçamento", "ORC ou DAV"],
  ["tipos_venda", "Siglas que contam como venda", "Ex.: VND"],
  ["tabela_preco", "Tabela de preço", "Ex.: VAREJISTA"],
  ["codigo_caixa", "Código do caixa", "Ex.: 1"],
] as const;
type Chave = (typeof CAMPOS)[number][0];

/** Códigos de uma empresa no Shop9 e o vínculo dos vendedores do Shop9 com as pessoas da Rota. */
export function EmpresaShop9({ empresa }: { empresa: EmpresaShop9 }) {
  const id = useId();
  const salvar = useSalvarEmpresaShop9();
  const mapear = useMapearVendedor();
  const anunciar = useAnunciar();
  const [v, setV] = useState<Record<Chave, string>>(
    () => Object.fromEntries(CAMPOS.map(([k]) => [k, empresa[k] ?? ""])) as Record<Chave, string>,
  );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await salvar.mutateAsync({
        _empresa_id: empresa.empresa_id,
        ...(Object.fromEntries(CAMPOS.map(([k]) => [`_${k}`, v[k]])) as Record<
          `_${Chave}`,
          string
        >),
      });
      toast.success("Códigos do Shop9 salvos.");
      anunciar("Códigos do Shop9 salvos.");
    } catch {
      toast.error("Não foi possível salvar. Confira os códigos (só números; siglas de 3 letras).");
    }
  }

  return (
    <section aria-labelledby={`${id}-t`} className="flex flex-col gap-4 rounded-lg border p-4">
      <h3 id={`${id}-t`} className="font-semibold">
        {empresa.nome}
      </h3>
      <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map(([k, rotulo, dica]) => (
          <div key={k} className="grid gap-1.5">
            <Label htmlFor={`${id}-${k}`}>{rotulo}</Label>
            <Input
              id={`${id}-${k}`}
              className="min-h-11"
              value={v[k]}
              placeholder={dica}
              maxLength={40}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
            />
          </div>
        ))}
        <Button
          type="submit"
          className="min-h-11 sm:col-span-2 sm:justify-self-start"
          disabled={salvar.isPending}
        >
          Salvar códigos
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">Vendedores do Shop9</h4>
        {empresa.vendedores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aparecem aqui depois da primeira sincronização do conector.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {empresa.vendedores.map((vd) => (
              <li key={vd.codigo} className="grid gap-1.5 sm:grid-cols-2 sm:items-center">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Label htmlFor={`${id}-vd-${vd.codigo}`}>
                    {vd.nome} (código {vd.codigo})
                  </Label>
                  {!vd.ativo && <SeloStatus tom="atencao">Inativo</SeloStatus>}
                  {!vd.usuario_id && <SeloStatus tom="perigo">Sem vínculo</SeloStatus>}
                </div>
                <select
                  id={`${id}-vd-${vd.codigo}`}
                  className={campo}
                  value={vd.usuario_id ?? ""}
                  onChange={(e) =>
                    mapear.mutate(
                      {
                        _empresa_id: empresa.empresa_id,
                        _codigo: vd.codigo,
                        _usuario_id: e.target.value || null,
                      },
                      { onError: () => toast.error("Não foi possível salvar o vínculo.") },
                    )
                  }
                >
                  <option value="">Sem vínculo (vale a carteira do cliente)</option>
                  {empresa.usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
