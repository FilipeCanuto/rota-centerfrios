import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/design-system/Logo";
import { Pinguim } from "@/design-system/Pinguim";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Rota CENTERFRIOS" },
      {
        name: "description",
        content: "Acesse a plataforma comercial CENTERFRIOS e 381 Distribuidora.",
      },
      { property: "og:title", content: "Entrar — Rota CENTERFRIOS" },
      {
        property: "og:description",
        content: "Acesse a plataforma comercial CENTERFRIOS e 381 Distribuidora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrar,
});

type Modo = "entrar" | "primeiro" | "recuperar";
const TITULOS: Record<Modo, string> = {
  entrar: "Entrar na Rota",
  primeiro: "Primeiro acesso",
  recuperar: "Esqueci minha senha",
};
const BOTOES: Record<Modo, string> = {
  entrar: "Entrar",
  primeiro: "Criar minha senha",
  recuperar: "Enviar link",
};

/** O banco recusa quem não é da empresa ou não foi convidado; mostra a explicação dele. */
function mensagemPrimeiroAcesso(msg: string): string {
  if (msg.includes("Acesso restrito"))
    return "Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora.";
  if (msg.includes("ainda não foi liberado"))
    return "Seu acesso ainda não foi liberado. Peça o convite ao administrador.";
  if (/password/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/database error/i.test(msg))
    return "Não foi possível liberar o acesso. Use o e-mail da empresa e peça o convite ao administrador.";
  return "Não foi possível criar a senha. Confira o e-mail ou peça ajuda ao administrador.";
}

function Entrar() {
  const id = useId();
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("entrar");
  const [verSenha, setVerSenha] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const trocar = (m: Modo) => {
    setModo(m);
    // O botão clicado some ao trocar de modo: o foco vai para o novo título.
    requestAnimationFrame(() => titulo.current?.focus());
    setErro(null);
    setAviso(null);
  };

  useEffect(() => {
    // O login com Google recusado (domínio ou convite) volta com o erro na URL.
    const params = new URLSearchParams(
      window.location.search + "&" + window.location.hash.slice(1),
    );
    const falha = params.get("error_description");
    if (falha) setErro(mensagemPrimeiroAcesso(falha));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/inicio", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/inicio", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro("E-mail ou senha incorretos, ou e-mail ainda não confirmado.");
    } else if (modo === "recuperar") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) setErro("Não foi possível enviar o link agora. Tente de novo em alguns minutos.");
      else setAviso("Se esse e-mail tiver acesso, enviamos um link para criar uma nova senha.");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.origin, data: { full_name: nome } },
      });
      if (error) setErro(mensagemPrimeiroAcesso(error.message));
      else setAviso("Senha criada. Confirme pelo link enviado ao seu e-mail para entrar.");
    }
    setEnviando(false);
  }

  async function google() {
    setErro(null);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) setErro("Não foi possível entrar com o Google.");
  }

  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo className="h-14" />
          <h1 ref={titulo} tabIndex={-1} className="text-2xl font-extrabold outline-none">
            {TITULOS[modo]}
          </h1>
          <p className="text-muted-foreground">
            Plataforma comercial CENTERFRIOS e 381 Distribuidora
          </p>
        </div>
        <div className="cartao p-6">
          <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
            {modo === "primeiro" && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-nome`}>Nome</Label>
                <Input
                  id={`${id}-nome`}
                  className="min-h-11"
                  autoComplete="name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-email`}>E-mail</Label>
              <Input
                id={`${id}-email`}
                type="email"
                className="min-h-11"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-describedby={erro ? `${id}-erro` : undefined}
              />
            </div>
            {modo !== "recuperar" && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-senha`}>
                  {modo === "primeiro" ? "Crie sua senha" : "Senha"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`${id}-senha`}
                    type={verSenha ? "text" : "password"}
                    className="min-h-11"
                    autoComplete={modo === "entrar" ? "current-password" : "new-password"}
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
                {modo === "entrar" && (
                  <Button
                    type="button"
                    variant="link"
                    className="self-start px-0"
                    onClick={() => trocar("recuperar")}
                  >
                    Esqueci minha senha
                  </Button>
                )}
              </div>
            )}
            {erro && (
              <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-perigo">
                {erro}
              </p>
            )}
            {/* Região sempre montada para o leitor de tela anunciar o aviso. */}
            <p role="status" className="text-sm font-semibold text-sucesso empty:hidden">
              {aviso}
            </p>
            <Button type="submit" size="lg" disabled={enviando}>
              {enviando ? "Aguarde…" : BOTOES[modo]}
            </Button>
          </form>
          {modo !== "recuperar" && (
            <>
              <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" size="lg" className="w-full" onClick={google}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                Continuar com Google
              </Button>
            </>
          )}
        </div>
        <div className="mt-6 text-center text-sm">
          {modo === "entrar" ? (
            <>
              <p>
                Primeiro acesso? Peça seu convite ao administrador e entre com o e-mail da empresa.
              </p>
              <Button variant="link" className="px-1" onClick={() => trocar("primeiro")}>
                Já fui convidado: criar minha senha
              </Button>
            </>
          ) : (
            <Button variant="link" className="px-1" onClick={() => trocar("entrar")}>
              Voltar para entrar
            </Button>
          )}
        </div>
        <div className="mt-6 flex justify-center text-foreground">
          <Pinguim className="size-10" />
        </div>
      </div>
    </main>
  );
}
