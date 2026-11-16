import { KeyRound, PlugZap } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnunciar } from "@/design-system/Anunciador";
import { EstadoErro } from "@/design-system/EstadoErro";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { SeloStatus } from "@/design-system/SeloStatus";
import { chavePublicaValida, conectorOnline } from "@/regras/conector";
import {
  useConfigurarShop9,
  useRegistrarChave,
  useRevogarConector,
  useStatusShop9,
  type AmbienteShop9,
  type ConectorStatus,
  type ModoShop9,
} from "./integracoesShop9";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Maceio" }) : "nunca";

const campo = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Cadastro (conector = null) ou troca da chave pública. A chave privada nunca sai do computador do conector. */
function FormChave({
  conector,
  aoTerminar,
}: {
  conector: ConectorStatus | null;
  aoTerminar: () => void;
}) {
  const id = useId();
  const registrar = useRegistrarChave();
  const anunciar = useAnunciar();
  const [nome, setNome] = useState(conector?.nome ?? "Computador do Integrações");
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return setErro("Informe um nome.");
    if (!chavePublicaValida(chave))
      return setErro("Chave pública inválida: cole a linha mostrada por npm run gerar-chave.");
    setErro(null);
    try {
      await registrar.mutateAsync({
        _conector_id: conector?.id ?? null,
        _nome: nome.trim(),
        _chave_publica: chave.trim(),
      });
    } catch {
      return setErro("Não foi possível salvar. Essa chave já está em uso?");
    }
    const texto = conector ? "Chave trocada: a anterior deixou de valer." : "Conector cadastrado.";
    toast.success(texto);
    anunciar(texto);
    aoTerminar();
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {!conector && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-nome`}>Nome do conector</Label>
          <Input
            id={`${id}-nome`}
            className="min-h-11"
            value={nome}
            maxLength={60}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-chave`}>Chave pública do conector</Label>
        <Input
          id={`${id}-chave`}
          className="min-h-11 font-mono"
          value={chave}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setChave(e.target.value)}
          aria-invalid={!!erro}
          aria-describedby={erro ? `${id}-erro` : undefined}
        />
      </div>
      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <Button type="submit" className="min-h-11" disabled={registrar.isPending}>
        <KeyRound aria-hidden="true" /> {conector ? "Trocar chave" : "Cadastrar conector"}
      </Button>
    </form>
  );
}

/** Configurações > Integrações > Shop9. Só administrador: o banco recusa os demais. */
export default function IntegracoesAba() {
  const id = useId();
  const status = useStatusShop9();
  const configurar = useConfigurarShop9();
  const revogar = useRevogarConector();
  const anunciar = useAnunciar();
  // undefined = fechado; null = novo conector; objeto = trocar chave daquele conector.
  const [editando, setEditando] = useState<ConectorStatus | null | undefined>(undefined);

  if (status.isPending)
    return <Skeleton className="h-48 w-full" aria-label="Carregando integração do Shop9" />;
  if (status.isError)
    return (
      <EstadoErro titulo="Não foi possível ler a integração" aoTentar={() => void status.refetch()}>
        Confira a conexão e tente de novo.
      </EstadoErro>
    );

  const s = status.data;

  async function salvar(modo: ModoShop9, ambiente: AmbienteShop9) {
    try {
      await configurar.mutateAsync({ _modo: modo, _ambiente: ambiente });
      toast.success("Integração atualizada.");
      anunciar("Integração atualizada.");
    } catch {
      toast.error("Não foi possível salvar.");
    }
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-6">
      <h2 id={`${id}-titulo`} className="text-lg font-semibold">
        Shop9
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-modo`}>Modo de envio dos orçamentos</Label>
          <select
            id={`${id}-modo`}
            className={campo}
            value={s.modo}
            onChange={(e) => void salvar(e.target.value as ModoShop9, s.ambiente)}
          >
            <option value="manual">Manual (CSV e lançamento à mão)</option>
            <option value="conector">Conector (automático)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-ambiente`}>Ambiente do Shop9</Label>
          <select
            id={`${id}-ambiente`}
            className={campo}
            value={s.ambiente}
            onChange={(e) => void salvar(s.modo, e.target.value as AmbienteShop9)}
          >
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </div>
      </div>

      {s.conectores.length === 0 ? (
        <EstadoVazio icone={PlugZap} titulo="Nenhum conector cadastrado">
          No computador do módulo Integrações, rode npm run gerar-chave e cadastre a chave pública
          mostrada.
        </EstadoVazio>
      ) : (
        <ul className="flex flex-col gap-3">
          {s.conectores.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.nome}</span>
                {!c.ativo ? (
                  <SeloStatus tom="perigo">Revogado</SeloStatus>
                ) : conectorOnline(c.ultimo_contato) ? (
                  <SeloStatus tom="sucesso">Online</SeloStatus>
                ) : (
                  <SeloStatus tom="atencao">Offline</SeloStatus>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Último contato: {quando(c.ultimo_contato)} · Versão: {c.versao ?? "—"}
              </p>
              <p className="break-all text-sm">
                Id para o config.json: <code className="font-mono">{c.id}</code>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" variant="outline" onClick={() => setEditando(c)}>
                  <KeyRound aria-hidden="true" />{" "}
                  {c.ativo ? "Trocar chave" : "Reativar com nova chave"}
                </Button>
                {c.ativo && (
                  <Button
                    className="min-h-11"
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(`Revogar "${c.nome}"? O conector para na hora.`))
                        revogar.mutate({ _conector_id: c.id });
                    }}
                  >
                    Revogar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {s.conectores.length === 0 && (
        <Button className="min-h-11 self-start" onClick={() => setEditando(null)}>
          <KeyRound aria-hidden="true" /> Cadastrar conector
        </Button>
      )}

      <section aria-labelledby={`${id}-eventos`} className="flex flex-col gap-2">
        <h3 id={`${id}-eventos`} className="font-semibold">
          Últimos envios e erros
        </h3>
        {s.eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada registrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {s.eventos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <SeloStatus tom={e.ok ? "sucesso" : "perigo"}>{e.ok ? "Certo" : "Erro"}</SeloStatus>
                <span>{quando(e.criado_em)}</span>
                <span className="font-medium">{e.tipo}</span>
                {e.mensagem && (
                  <span className="break-words text-muted-foreground">{e.mensagem}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={editando !== undefined}
        onOpenChange={(aberto) => !aberto && setEditando(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? "Trocar chave do conector" : "Cadastrar conector"}
            </DialogTitle>
            <DialogDescription>
              Cole a chave pública mostrada pelo conector. Ela não é segredo; a chave privada fica
              só naquele computador.
            </DialogDescription>
          </DialogHeader>
          {editando !== undefined && (
            <FormChave conector={editando} aoTerminar={() => setEditando(undefined)} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
