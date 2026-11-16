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
import { conectorOnline } from "@/regras/conector";
import {
  useConfigurarShop9,
  useGerarToken,
  useRevogarConector,
  useStatusShop9,
  type AmbienteShop9,
  type ModoShop9,
} from "./integracoesShop9";

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Maceio" }) : "nunca";

const campo = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Configurações > Integrações > Shop9. Só administrador: o banco recusa os demais. */
export default function IntegracoesAba() {
  const id = useId();
  const status = useStatusShop9();
  const configurar = useConfigurarShop9();
  const gerar = useGerarToken();
  const revogar = useRevogarConector();
  const anunciar = useAnunciar();
  const [nome, setNome] = useState("Computador do Integrações");
  const [token, setToken] = useState<string | null>(null);

  if (status.isPending)
    return <Skeleton className="h-48 w-full" aria-label="Carregando integração do Shop9" />;
  if (status.isError)
    return (
      <EstadoErro titulo="Não foi possível ler a integração" aoTentar={() => void status.refetch()}>
        Confira a conexão e tente de novo.
      </EstadoErro>
    );

  const s = status.data;

  async function novoToken(conectorId: string | null) {
    try {
      const r = await gerar.mutateAsync({ _conector_id: conectorId, _nome: nome.trim() });
      setToken(r.token);
      anunciar("Token gerado. Copie agora: ele não será mostrado de novo.");
    } catch {
      toast.error("Não foi possível gerar o token.");
    }
  }

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
          Gere um token e cole-o no conector instalado no computador do módulo Integrações.
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
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" variant="outline" onClick={() => void novoToken(c.id)}>
                  <KeyRound aria-hidden="true" />{" "}
                  {c.ativo ? "Girar token" : "Reativar com novo token"}
                </Button>
                {c.ativo && (
                  <Button
                    className="min-h-11"
                    variant="destructive"
                    onClick={() => {
                      if (
                        window.confirm(`Revogar o token de "${c.nome}"? O conector para na hora.`)
                      )
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
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor={`${id}-nome`}>Nome do conector</Label>
            <Input
              id={`${id}-nome`}
              className="min-h-11"
              value={nome}
              maxLength={60}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <Button className="min-h-11" disabled={!nome.trim()} onClick={() => void novoToken(null)}>
            <KeyRound aria-hidden="true" /> Gerar token
          </Button>
        </div>
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

      <Dialog open={!!token} onOpenChange={(aberto) => !aberto && setToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token do conector</DialogTitle>
            <DialogDescription>
              Copie agora e cole no conector. Ele não será mostrado de novo; a Rota guarda só uma
              versão embaralhada (hash).
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor={`${id}-token`}>Token</Label>
          <Input id={`${id}-token`} readOnly value={token ?? ""} className="min-h-11 font-mono" />
          <Button
            className="min-h-11"
            onClick={() => {
              void navigator.clipboard?.writeText(token ?? "");
              toast.success("Token copiado.");
            }}
          >
            Copiar
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
