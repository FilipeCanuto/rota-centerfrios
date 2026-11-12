import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotaoVoltar } from "@/design-system/BotaoVoltar";
import { Logo } from "@/design-system/Logo";
import { supabase } from "@/integrations/supabase/client";
import { ehLinkDeRecuperacao } from "@/regras";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha — Rota CENTERFRIOS" },
      { name: "description", content: "Crie uma nova senha para entrar na Rota." },
    ],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const id = useId();
  const navigate = useNavigate();
  // O link do e-mail abre uma sessão de recuperação; sem ela, o link expirou ou já foi usado.
  const [temSessao, setTemSessao] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [email, setEmail] = useState("");

  useEffect(() => {
    // Só um link de recuperação abre esta tela. Uma sessão comum (aparelho já logado)
    // não permite trocar a senha sem saber a atual.
    const veioDoLink =
      ehLinkDeRecuperacao(window.location.search, window.location.hash) ||
      /[?&]code=/.test(window.location.search);
    if (!veioDoLink) {
      setTemSessao(false);
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") {
        setTemSessao(true);
        setEmail(s?.user.email ?? "");
      }
    });
    // Se o evento de recuperação passou antes de este efeito assinar, a sessão já aberta pelo link vale.
    void supabase.auth.getSession().then(({ data: d }) => {
      if (d.session) {
        setTemSessao(true);
        setEmail(d.session.user.email ?? "");
      }
    });
    const limite = setTimeout(() => setTemSessao((v) => v ?? false), 8000);
    return () => {
      clearTimeout(limite);
      data.subscription.unsubscribe();
    };
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmacao) return setErro("As duas senhas não são iguais.");
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error)
      return setErro(
        /different from the old/i.test(error.message)
          ? "A nova senha precisa ser diferente da anterior."
          : /weak|short|characters/i.test(error.message)
            ? "Escolha uma senha mais forte, com pelo menos 6 caracteres."
            : "Não foi possível salvar a nova senha. Peça um novo link.",
      );
    navigate({ to: "/inicio", replace: true });
  }

  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <BotaoVoltar className="-ml-3 mb-4" />
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo className="h-14" />
          <h1 className="text-2xl font-extrabold">Crie uma nova senha</h1>
        </div>
        <div className="cartao p-6">
          {temSessao === false ? (
            <div role="alert" className="flex flex-col gap-3">
              <p>Este link expirou ou já foi usado.</p>
              <Button asChild variant="outline">
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
                    id={`${id}-senha`}
                    type={verSenha ? "text" : "password"}
                    className="min-h-11"
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                    aria-describedby={erro ? `${id}-erro` : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-pressed={verSenha}
                    aria-controls={`${id}-senha`}
                    aria-label="Mostrar senha"
                    onClick={() => setVerSenha((v) => !v)}
                  >
                    {verSenha ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
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
              <Button type="submit" size="lg" disabled={enviando || temSessao === null}>
                {enviando ? "Salvando…" : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
