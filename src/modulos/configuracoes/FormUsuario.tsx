import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAnunciar } from "@/design-system/Anunciador";
import { useSessao } from "@/modulos/sessao/sessao";
import { useCatalogo } from "@/modulos/setores/setores";
import { validarAcessos } from "@/regras";
import { PAPEIS, useSalvarUsuario, type UsuarioAcessos } from "./usuarios";

type Grupo = "papeis" | "empresas" | "setores";

function Caixas({
  id,
  legenda,
  opcoes,
  marcados,
  erro,
  aoMudar,
}: {
  id: string;
  legenda: string;
  opcoes: { valor: string; rotulo: string }[];
  marcados: string[];
  erro: string | undefined;
  aoMudar: (v: string[]) => void;
}) {
  return (
    <fieldset className="grid gap-1" aria-describedby={erro ? `${id}-erro` : undefined}>
      <legend className="mb-1 text-sm font-semibold">{legenda}</legend>
      {opcoes.map((o) => (
        <div key={o.valor} className="flex min-h-11 items-center gap-3">
          <Checkbox
            id={`${id}-${o.valor}`}
            className="size-5"
            checked={marcados.includes(o.valor)}
            onCheckedChange={(v) =>
              aoMudar(v === true ? [...marcados, o.valor] : marcados.filter((m) => m !== o.valor))
            }
          />
          <Label htmlFor={`${id}-${o.valor}`}>{o.rotulo}</Label>
        </div>
      ))}
      {erro && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

/** Pré-cadastro (usuario = null) ou edição de acessos, só para administradores. */
export function FormUsuario({
  usuario,
  aoTerminar,
}: {
  usuario: UsuarioAcessos | null;
  aoTerminar: () => void;
}) {
  const id = useId();
  const { data: sessao } = useSessao();
  const { data: catalogo } = useCatalogo();
  // Todo setor ativo pode receber acesso; só os "disponíveis" aparecem no login (ver docs/setores.md).
  const ativas = (catalogo?.linhas ?? []).filter((l) => l.ativo);
  const salvar = useSalvarUsuario();
  const anunciar = useAnunciar();
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [papeis, setPapeis] = useState(usuario?.papeis ?? ["vendedor"]);
  const [empresas, setEmpresas] = useState(usuario?.empresas ?? []);
  // Setores indisponíveis não aparecem, mas continuam gravados como estavam.
  const ocultos = (usuario?.setores ?? []).filter((s) => !ativas.some((a) => a.chave === s));
  const [setores, setSetores] = useState(usuario?.setores ?? ["comercial"]);
  const [avisos, setAvisos] = useState(usuario?.pode_publicar_avisos ?? false);
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [erro, setErro] = useState<{ campo: string; mensagem: string } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const form = { nome, email, papeis, empresas, setores };
    const problema = validarAcessos(form);
    setErro(problema);
    if (problema) return;
    try {
      await salvar.mutateAsync({
        ...form,
        setores: [...setores.filter((s) => ativas.some((a) => a.chave === s)), ...ocultos],
        id: usuario?.id ?? null,
        ativo,
        pode_publicar_avisos: avisos,
      });
    } catch (err) {
      const msg = (err as { message?: string }).message ?? "";
      setErro({ campo: "", mensagem: msg || "Não foi possível salvar. Tente de novo." });
      return;
    }
    const texto = usuario ? "Acessos atualizados." : "Pré-cadastro feito.";
    toast.success(texto);
    anunciar(texto);
    aoTerminar();
  }

  const msg = (c: Grupo) => (erro?.campo === c ? erro.mensagem : undefined);
  const invalido = (c: string) => erro?.campo === c;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-nome`}>Nome</Label>
        <Input
          id={`${id}-nome`}
          className="min-h-11"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={invalido("nome")}
          aria-describedby={invalido("nome") ? `${id}-erro` : undefined}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-email`}>E-mail da empresa</Label>
        <Input
          id={`${id}-email`}
          type="email"
          className="min-h-11"
          value={email}
          disabled={usuario?.temLogin}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={invalido("email")}
          aria-describedby={invalido("email") ? `${id}-erro` : undefined}
        />
      </div>
      <Caixas
        id={`${id}-papeis`}
        legenda="Papel"
        opcoes={PAPEIS.map((p) => ({ ...p }))}
        marcados={papeis}
        erro={msg("papeis")}
        aoMudar={setPapeis}
      />
      <Caixas
        id={`${id}-empresas`}
        legenda="Empresas"
        opcoes={(sessao?.empresas ?? []).map((e) => ({ valor: e.id, rotulo: e.nome }))}
        marcados={empresas}
        erro={msg("empresas")}
        aoMudar={setEmpresas}
      />
      <Caixas
        id={`${id}-setores`}
        legenda="Setores liberados"
        opcoes={ativas.map((l) => ({ valor: l.chave, rotulo: l.nome }))}
        marcados={setores}
        erro={msg("setores")}
        aoMudar={setSetores}
      />
      <div className="flex min-h-11 items-center gap-3">
        <Switch id={`${id}-avisos`} checked={avisos} onCheckedChange={setAvisos} />
        <Label htmlFor={`${id}-avisos`}>Pode publicar avisos</Label>
      </div>
      {usuario && (
        <div className="flex min-h-11 items-center gap-3">
          <Switch id={`${id}-ativo`} checked={ativo} onCheckedChange={setAtivo} />
          <Label htmlFor={`${id}-ativo`}>Conta ativa</Label>
        </div>
      )}
      {erro && !["papeis", "empresas", "setores"].includes(erro.campo) && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-perigo">
          {erro.mensagem}
        </p>
      )}
      <Button type="submit" className="min-h-11" disabled={salvar.isPending}>
        {salvar.isPending ? "Salvando…" : usuario ? "Salvar acessos" : "Pré-cadastrar"}
      </Button>
    </form>
  );
}
