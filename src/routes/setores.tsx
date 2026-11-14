import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ChevronRight, LogOut, ShieldOff } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/design-system/EstadoErro";
import { Logo } from "@/design-system/Logo";
import { supabase } from "@/integrations/supabase/client";
import { MalhaLuz } from "@/modulos/login/MalhaLuz";
import { useSessao } from "@/modulos/sessao/sessao";
import {
  lembrarSetor,
  setorLembrado,
  useCatalogo,
  type SetorTela,
} from "@/modulos/setores/setores";
import { destinoAposLogin } from "@/regras";

export const Route = createFileRoute("/setores")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ trocar: s["trocar"] === true }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  head: () => ({ meta: [{ title: "Escolha o setor — Rota CENTERFRIOS" }] }),
  component: TelaSetores,
});

const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as React.CSSProperties;

function TelaSetores() {
  const { trocar } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sessaoQ = useSessao();
  const catalogoQ = useCatalogo();
  const sessao = sessaoQ.data;
  const catalogo = catalogoQ.data;
  const isLoading = sessaoQ.isLoading || catalogoQ.isLoading;
  const isError = sessaoQ.isError || catalogoQ.isError;
  const refetch = () => Promise.all([sessaoQ.refetch(), catalogoQ.refetch()]);
  const [lembrar, setLembrar] = useState(() => !trocar && setorLembrado() !== null);
  const idLembrar = useId();

  const destino =
    sessao && catalogo
      ? destinoAposLogin(sessao.setores, catalogo.chaves, trocar ? null : setorLembrado())
      : null;
  const direto = destino?.tipo === "direto" ? catalogo?.porChave(destino.setor) : undefined;

  useEffect(() => {
    if (direto) void navigate({ to: direto.rotaInicial, replace: true });
  }, [direto, navigate]);

  function entrar(s: SetorTela) {
    lembrarSetor(lembrar ? s.chave : null);
    void navigate({ to: s.rotaInicial });
  }

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  let corpo: React.ReactNode;
  if (isError)
    corpo = (
      <>
        <h1 className="text-2xl font-extrabold">Escolha o setor</h1>
        <EstadoErro titulo="Não foi possível carregar seus setores" aoTentar={() => void refetch()}>
          Confira a conexão e tente de novo.
        </EstadoErro>
      </>
    );
  else if (isLoading || !destino || destino.tipo === "direto")
    corpo = (
      <>
        <h1 className="sr-only">Abrindo o seu setor</h1>
        <Skeleton className="h-40 w-full rounded-2xl" role="status" aria-label="Carregando" />
      </>
    );
  else if (destino.tipo === "sem_acesso")
    corpo = (
      <div className="cartao subir flex flex-col items-center gap-4 p-8 text-center">
        <ShieldOff className="size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-extrabold">Sem acesso liberado</h1>
        <p className="text-foreground/80">
          Sua conta ainda não tem nenhum setor liberado. Fale com o administrador.
        </p>
        <Button variant="outline" className="min-h-11" onClick={() => void sair()}>
          <LogOut aria-hidden="true" /> Sair
        </Button>
      </div>
    );
  else
    corpo = (
      <>
        <div className="subir flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-2xl font-extrabold sm:text-3xl">Escolha o setor</h1>
          <p className="text-foreground/80">
            {sessao?.usuario?.nome ? `Olá, ${sessao.usuario.nome}. ` : ""}Onde você quer trabalhar
            agora?
          </p>
        </div>
        <ul className="cascata grid gap-3 sm:grid-cols-2" aria-label="Setores liberados">
          {destino.setores.map((chave) => {
            const s = catalogo!.porChave(chave)!;
            return (
              <li key={chave}>
                <button
                  type="button"
                  onClick={() => entrar(s)}
                  className="cartao cartao-interativo pressionar flex min-h-24 w-full items-center gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <s.icone className="size-6" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-bold">{s.nome}</span>
                    <span className="text-sm text-foreground/80">{s.descricao}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="subir flex items-center gap-3" style={atraso(200)}>
          <Checkbox
            id={idLembrar}
            className="size-5"
            checked={lembrar}
            onCheckedChange={(v) => setLembrar(v === true)}
          />
          <Label htmlFor={idLembrar} className="min-h-11 content-center">
            Lembrar minha escolha neste aparelho
          </Label>
        </div>
        <Button variant="ghost" className="min-h-11 self-start" onClick={() => void sair()}>
          <LogOut aria-hidden="true" /> Sair
        </Button>
      </>
    );

  return (
    <main
      id="conteudo"
      className="relative grid min-h-dvh grid-cols-[minmax(0,1fr)] place-items-center overflow-hidden px-4 py-10"
    >
      <MalhaLuz />
      <div className="relative flex w-full max-w-2xl flex-col gap-6">
        <div className="subir flex justify-center sm:justify-start">
          <Logo className="h-12" />
        </div>
        {corpo}
      </div>
    </main>
  );
}
