import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotaoVoltar } from "@/design-system/BotaoVoltar";
import { Logo } from "@/design-system/Logo";
import { Pinguim } from "@/design-system/Pinguim";
import { TransicaoEntrada } from "@/design-system/TransicaoEntrada";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { levarLinkDeRecuperacao } from "@/modulos/sessao/recuperacao";
import {
  causaDoLink,
  causaDoLogin,
  linkExpirado,
  MENSAGEM_LINK,
  MENSAGEM_LOGIN,
  normalizarEmail,
  validarAcesso,
} from "@/regras";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: () => levarLinkDeRecuperacao("/auth"),
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

/** Dois caminhos: senha, ou um link por e-mail (primeiro acesso, senha esquecida ou conta do Google). */
type Modo = "entrar" | "link";
const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as React.CSSProperties;

/** Nome do cadastro para o "Bem-vindo"; sem ele, o nome da conta do Google. */
async function nomeDoUsuario(authId: string, reserva: unknown): Promise<string | null> {
  const { data } = await supabase
    .from("usuarios")
    .select("nome")
    .eq("auth_user_id", authId)
    .maybeSingle();
  return data?.nome ?? (typeof reserva === "string" ? reserva : null);
}

function Entrar() {
  const id = useId();
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("entrar");
  const [verSenha, setVerSenha] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<{ campo: "email" | "senha" | null; texto: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sugerirLink, setSugerirLink] = useState(false);
  // Depois do login: check animado e boas-vindas antes do Início.
  const [entrando, setEntrando] = useState<{ nome: string | null } | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);

  const trocar = (m: Modo) => {
    setModo(m);
    // O botão clicado some ao trocar de modo: o foco vai para o novo título.
    requestAnimationFrame(() => titulo.current?.focus());
    setErro(null);
    setAviso(null);
    setSugerirLink(false);
  };

  useEffect(() => {
    // Login recusado (domínio ou convite) ou link vencido voltam com o erro no endereço.
    const params = new URLSearchParams(
      window.location.search + "&" + window.location.hash.slice(1),
    );
    const falha = params.get("error_description");
    if (!falha) return;
    setErro({
      campo: null,
      texto: linkExpirado(params.toString())
        ? "O link expirou ou já foi usado. Peça um novo em “Receber link de acesso”."
        : /restrito/i.test(falha)
          ? "Acesso restrito a e-mails da CENTERFRIOS e da 381 Distribuidora."
          : MENSAGEM_LINK.sem_convite,
    });
  }, []);

  useEffect(() => {
    // Já tem sessão neste aparelho: vai direto, sem animação.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/inicio", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e !== "SIGNED_IN" || !s) return;
      setEntrando({ nome: null });
      void nomeDoUsuario(s.user.id, s.user.user_metadata?.["full_name"]).then((nome) =>
        setEntrando((v) => (v ? { nome } : v)),
      );
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  function falhar(campo: "email" | "senha" | null, texto: string) {
    setErro({ campo, texto });
    if (campo === "email") campoEmail.current?.focus();
    if (campo === "senha") campoSenha.current?.focus();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setSugerirLink(false);
    const problema = validarAcesso(email, modo === "entrar" ? senha : null);
    if (problema) return falhar(problema.campo, problema.mensagem);
    const endereco = normalizarEmail(email);
    setEnviando(true);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({
        email: endereco,
        password: senha,
      });
      if (error) {
        const causa = causaDoLogin(error);
        falhar(causa === "credenciais" ? "senha" : null, MENSAGEM_LOGIN[causa]);
        setSugerirLink(causa === "credenciais" || causa === "nao_confirmado");
      }
    } else {
      // O mesmo link serve para o primeiro acesso (o banco confere o convite), para quem esqueceu
      // a senha e para quem só entrava com o Google. Ao abrir, a pessoa já entra e cria a senha.
      const { error } = await supabase.auth.signInWithOtp({
        email: endereco,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/redefinir-senha`,
        },
      });
      if (error) falhar(null, MENSAGEM_LINK[causaDoLink(error)]);
      else
        setAviso(
          `Enviamos um link para ${endereco}. Abra o e-mail neste aparelho e toque no link para entrar. Confira também o spam.`,
        );
    }
    setEnviando(false);
  }

  async function google() {
    setErro(null);
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (r.error) falhar(null, "Não foi possível entrar com o Google. Tente de novo.");
  }

  if (entrando)
    return (
      <TransicaoEntrada
        nome={entrando.nome}
        aoTerminar={() => void navigate({ to: "/inicio", replace: true })}
      />
    );

  const descricao = (campo: "email" | "senha") =>
    erro && (erro.campo === campo || erro.campo === null) ? `${id}-erro` : undefined;

  return (
    <main
      id="conteudo"
      className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10"
    >
      {/* Fundo em movimento lento: só decoração. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora absolute -left-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div
          className="aurora absolute -bottom-32 -right-20 size-[28rem] rounded-full bg-ouro/20 blur-3xl"
          style={{ animationDelay: "-11s" }}
        />
      </div>
      <div className="w-full max-w-md">
        {modo !== "entrar" && (
          <BotaoVoltar aoVoltar={() => trocar("entrar")} className="subir -ml-3 mb-4" />
        )}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="subir" style={atraso(0)}>
            <Logo className="h-14" />
          </div>
          <h1
            ref={titulo}
            tabIndex={-1}
            className="subir text-2xl font-extrabold outline-none"
            style={atraso(80)}
            key={modo}
          >
            {modo === "entrar" ? "Entrar na Rota" : "Receber link de acesso"}
          </h1>
          <p className="subir text-muted-foreground" style={atraso(140)} key={`${modo}-p`}>
            {modo === "entrar"
              ? "Plataforma Comercial CENTERFRIOS e 381 Distribuidora"
              : "Primeiro acesso, esqueceu a senha ou sempre entrou com o Google? Enviamos um link para você entrar e criar sua senha."}
          </p>
        </div>
        <div className="cartao subir p-6 shadow-lg" style={atraso(200)}>
          <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-email`}>E-mail da empresa</Label>
              <Input
                ref={campoEmail}
                id={`${id}-email`}
                type="email"
                inputMode="email"
                className="min-h-11"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="nome@centerfrios.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={erro?.campo === "email"}
                aria-describedby={descricao("email")}
              />
            </div>
            {modo === "entrar" && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-senha`}>Senha</Label>
                <div className="flex gap-2">
                  <Input
                    ref={campoSenha}
                    id={`${id}-senha`}
                    type={verSenha ? "text" : "password"}
                    className="min-h-11"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    aria-invalid={erro?.campo === "senha"}
                    aria-describedby={descricao("senha")}
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
              </div>
            )}
            {erro && (
              <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-perigo">
                {erro.texto}
              </p>
            )}
            {/* Região sempre montada para o leitor de tela anunciar o aviso. */}
            <p role="status" className="text-sm font-semibold text-sucesso empty:hidden">
              {aviso}
            </p>
            <Button type="submit" size="lg" className="min-h-11 transicao" disabled={enviando}>
              {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Enviar link"}
            </Button>
            {modo === "entrar" && (
              <Button
                type="button"
                variant={sugerirLink ? "secondary" : "link"}
                className="min-h-11 self-center"
                onClick={() => trocar("link")}
              >
                <Mail aria-hidden="true" /> Primeiro acesso ou esqueci a senha
              </Button>
            )}
          </form>
          {modo === "entrar" && (
            <>
              <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 w-full"
                onClick={google}
              >
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
        <p className="subir mt-6 text-center text-sm text-muted-foreground" style={atraso(320)}>
          Ainda não tem acesso? Peça ao administrador para cadastrar o seu e-mail da empresa.
        </p>
        <div className="subir mt-6 flex justify-center" style={atraso(400)}>
          <Pinguim className="flutuar size-16" expressao={modo === "entrar" ? "feliz" : "atento"} />
        </div>
      </div>
    </main>
  );
}
