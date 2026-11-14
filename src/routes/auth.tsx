import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Mail } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotaoVoltar } from "@/design-system/BotaoVoltar";
import { Logo } from "@/design-system/Logo";
import { Mascote } from "@/design-system/Mascote";
import { TransicaoEntrada } from "@/design-system/TransicaoEntrada";
import { supabase } from "@/integrations/supabase/client";
import { MalhaLuz } from "@/modulos/login/MalhaLuz";
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

const PalcoLogin = lazy(() => import("@/modulos/login/PalcoLogin"));

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
      if (data.user) navigate({ to: "/setores", search: { trocar: false }, replace: true });
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

  if (entrando)
    return (
      <TransicaoEntrada
        nome={entrando.nome}
        aoTerminar={() =>
          void navigate({ to: "/setores", search: { trocar: false }, replace: true })
        }
      />
    );

  const descricao = (campo: "email" | "senha") =>
    erro && (erro.campo === campo || erro.campo === null) ? `${id}-erro` : undefined;

  return (
    <main
      id="conteudo"
      className="relative grid min-h-dvh grid-cols-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[58fr_42fr]"
    >
      <div className="relative grid grid-cols-[minmax(0,1fr)] place-items-center px-4 py-8 lg:col-start-2 lg:row-start-1 lg:py-10">
        <MalhaLuz />
        <div className="w-full max-w-md">
          {modo !== "entrar" && (
            <BotaoVoltar aoVoltar={() => trocar("entrar")} className="subir -ml-3 mb-4" />
          )}
          <div className="mb-6 flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <div className="subir" style={atraso(0)}>
              <Logo className="h-12" />
            </div>
            <h1
              ref={titulo}
              tabIndex={-1}
              className="subir text-2xl font-extrabold outline-none sm:text-3xl"
              style={atraso(80)}
              key={modo}
            >
              {modo === "entrar" ? "Entrar na Rota" : "Receber link de acesso"}
            </h1>
            <p className="subir text-foreground/80" style={atraso(140)} key={`${modo}-p`}>
              {modo === "entrar"
                ? "Plataforma Comercial CENTERFRIOS e 381 Distribuidora"
                : "Primeiro acesso ou esqueceu a senha? Enviamos um link para você entrar e criar sua senha."}
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
                      className="min-h-11 min-w-0"
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
          </div>
          <p
            className="subir mt-6 text-center text-sm text-foreground lg:text-left"
            style={atraso(320)}
          >
            Ainda não tem acesso? Peça ao administrador para cadastrar o seu e-mail da empresa.
          </p>
          <div className="subir mt-6 flex justify-center lg:justify-start" style={atraso(400)}>
            <Mascote
              className="flutuar"
              tamanho={64}
              estado={modo === "entrar" ? "feliz" : "atento"}
            />
          </div>
        </div>
      </div>
      {/* Palco de mídia: depois do formulário no DOM (a tabulação começa nele), antes na tela. */}
      <div
        className="order-first max-[340px]:hidden lg:order-none lg:col-start-1 lg:row-start-1 lg:h-dvh lg:p-4"
        data-testid="palco-login"
      >
        <div className="h-36 overflow-hidden sm:h-52 md:h-64 lg:h-full lg:rounded-3xl">
          <Suspense fallback={<div className="size-full bg-[var(--polar-noite-900)]" />}>
            <PalcoLogin />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
