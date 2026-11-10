import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
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
      { name: "description", content: "Acesse a plataforma comercial CENTERFRIOS e 381 Distribuidora." },
      { property: "og:title", content: "Entrar — Rota CENTERFRIOS" },
      { property: "og:description", content: "Acesse a plataforma comercial CENTERFRIOS e 381 Distribuidora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const id = useId();
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/inicio", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) navigate({ to: "/inicio", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setAviso(null); setEnviando(true);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro("E-mail ou senha incorretos, ou e-mail ainda não confirmado.");
    } else {
      const { error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin, data: { full_name: nome } } });
      if (error) setErro(error.message.includes("Password") ? "A senha precisa ter pelo menos 6 caracteres." : "Não foi possível criar a conta.");
      else setAviso("Conta criada. Confirme pelo link enviado ao seu e-mail para entrar.");
    }
    setEnviando(false);
  }

  async function google() {
    setErro(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setErro("Não foi possível entrar com o Google.");
  }

  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo className="h-14" />
          <h1 className="text-2xl font-extrabold">{modo === "entrar" ? "Entrar na Rota" : "Criar conta"}</h1>
          <p className="text-muted-foreground">Plataforma comercial CENTERFRIOS e 381 Distribuidora</p>
        </div>
        <div className="cartao p-6">
          <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
            {modo === "cadastrar" && (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-nome`}>Nome</Label>
                <Input id={`${id}-nome`} className="min-h-11" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-email`}>E-mail</Label>
              <Input id={`${id}-email`} type="email" className="min-h-11" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required aria-describedby={erro ? `${id}-erro` : undefined} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-senha`}>Senha</Label>
              <Input id={`${id}-senha`} type="password" className="min-h-11" autoComplete={modo === "entrar" ? "current-password" : "new-password"} value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} aria-describedby={erro ? `${id}-erro` : undefined} />
            </div>
            {erro && <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-perigo">{erro}</p>}
            {aviso && <p role="status" className="text-sm font-semibold text-sucesso">{aviso}</p>}
            <Button type="submit" size="lg" disabled={enviando}>{enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}</Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={google}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
            Continuar com Google
          </Button>
        </div>
        <p className="mt-6 text-center text-sm">
          {modo === "entrar" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
          <Button variant="link" className="px-1" onClick={() => { setModo(modo === "entrar" ? "cadastrar" : "entrar"); setErro(null); setAviso(null); }}>
            {modo === "entrar" ? "Criar conta" : "Entrar"}
          </Button>
        </p>
        <div className="mt-6 flex justify-center text-foreground"><Pinguim className="size-10" /></div>
      </div>
    </main>
  );
}
