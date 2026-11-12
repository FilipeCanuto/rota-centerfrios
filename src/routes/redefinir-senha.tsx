import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotaoVoltar } from "@/design-system/BotaoVoltar";
import { Logo } from "@/design-system/Logo";
import { TransicaoEntrada } from "@/design-system/TransicaoEntrada";
import { supabase } from "@/integrations/supabase/client";
import {
  chegouPorLink,
  esquecerChegadaPorLink,
  marcarChegadaPorLink,
} from "@/modulos/sessao/recuperacao";
import { ehLinkDeAcesso, linkExpirado, mensagemSenhaNova } from "@/regras";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Crie sua senha — Rota CENTERFRIOS" },
      { name: "description", content: "Crie a senha para entrar na Rota." },
    ],
  }),
  component: CriarSenha,
});

const MINIMO = 8;

function CriarSenha() {
  const id = useId();
  const navigate = useNavigate();
  // Lido no primeiro render, antes de o Supabase limpar o endereço ao abrir a sessão do link.
  const [veioDoLink] = useState(() => {
    const { search, hash } = window.location;
    if (linkExpirado(`${search}&${hash}`)) return false;
    if (ehLinkDeAcesso(search, hash)) {
      marcarChegadaPorLink();
      return true;
    }
    return chegouPorLink();
  });
  // Só quem abriu um link do e-mail cria a senha aqui; uma sessão comum não troca a senha.
  const [situacao, setSituacao] = useState<"verificando" | "pronto" | "expirado">(
    veioDoLink ? "verificando" : "expirado",
  );
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [entrando, setEntrando] = useState<{ nome: string | null } | null>(null);
  const campoSenha = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!veioDoLink) return;
    // getSession espera o Supabase terminar de ler o link do endereço.
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        esquecerChegadaPorLink();
        return setSituacao("expirado");
      }
      setEmail(data.session.user.email ?? "");
      setSituacao("pronto");
    });
  }, [veioDoLink]);

  async function entrar() {
    esquecerChegadaPorLink();
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("auth_user_id", u.user?.id ?? "")
      .maybeSingle();
    setEntrando({ nome: data?.nome ?? null });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < MINIMO) {
      campoSenha.current?.focus();
      return setErro(`A senha precisa ter pelo menos ${MINIMO} caracteres.`);
    }
    if (senha !== confirmacao) return setErro("As duas senhas não são iguais.");
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemSenhaNova(error.message));
    await entrar();
  }

  if (entrando)
    return (
      <TransicaoEntrada
        nome={entrando.nome}
        aoTerminar={() => void navigate({ to: "/inicio", replace: true })}
      />
    );

  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <BotaoVoltar className="-ml-3 mb-4" />
        <div className="subir mb-8 flex flex-col items-center gap-4 text-center">
          <Logo className="h-14" />
          <h1 className="text-2xl font-extrabold">Crie sua senha</h1>
          {situacao === "pronto" && (
            <p className="text-muted-foreground">
              Você já entrou com o link. Crie uma senha para as próximas vezes ou siga sem criar.
            </p>
          )}
        </div>
        <div className="cartao subir p-6" style={{ "--atraso": "120ms" } as React.CSSProperties}>
          {situacao === "expirado" ? (
            <div role="alert" className="flex flex-col gap-3">
              <p>Este link expirou ou já foi usado.</p>
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/auth">Pedir um novo link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
              {/* Para o gerenciador de senhas saber de qual conta é a senha nova. */}
              <input
                type="email"
                name="username"
                autoComplete="username"
                value={email}
                readOnly
                hidden
              />
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-senha`}>Nova senha</Label>
                <div className="flex gap-2">
                  <Input
                    ref={campoSenha}
                    id={`${id}-senha`}
                    type={verSenha ? "text" : "password"}
                    className="min-h-11"
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={MINIMO}
                    aria-describedby={`${id}-dica${erro ? ` ${id}-erro` : ""}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-pressed={verSenha}
                    aria-controls={`${id}-senha`}
                    aria-label="Mostrar senha"
                    onClick={() => setVerSenha((v) => !v)}
                  >
                    {verSenha ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
                <p id={`${id}-dica`} className="text-sm text-muted-foreground">
                  Pelo menos {MINIMO} caracteres, misturando letras e números.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-confirmar`}>Repita a nova senha</Label>
                <Input
                  id={`${id}-confirmar`}
                  type={verSenha ? "text" : "password"}
                  className="min-h-11"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  required
                  aria-describedby={erro ? `${id}-erro` : undefined}
                />
              </div>
              {erro && (
                <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-perigo">
                  {erro}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="min-h-11"
                disabled={enviando || situacao !== "pronto"}
              >
                {enviando ? "Salvando…" : "Salvar senha e entrar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={situacao !== "pronto"}
                onClick={() => void entrar()}
              >
                Agora não, entrar sem criar senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
