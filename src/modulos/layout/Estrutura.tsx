import { Outlet } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useEffect } from "react";
import { useTema, type Tema } from "@/design-system/tema";
import { ProvedorEmpresa, useSessao } from "@/modulos/sessao/sessao";
import { BarraInferior } from "./BarraInferior";
import { Cabecalho } from "./Cabecalho";
import { MenuLateral } from "./MenuLateral";

const TEMAS: Tema[] = ["claro", "escuro", "auto"];

export function Estrutura() {
  const { data: sessao } = useSessao();
  const { tema, definirTema } = useTema();
  const temaSalvo = TEMAS.find((t) => t === sessao?.usuario?.tema);
  // O tema escolhido em outro aparelho vale aqui também.
  useEffect(() => {
    if (temaSalvo && temaSalvo !== tema) definirTema(temaSalvo, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o cadastro muda
  }, [temaSalvo]);
  return (
    <ProvedorEmpresa>
      <a href="#conteudo" className="pular-link">
        Pular para o conteúdo
      </a>
      <SidebarProvider>
        <div className="flex min-h-dvh w-full">
          <MenuLateral />
          <div className="flex min-w-0 flex-1 flex-col">
            <Cabecalho />
            <main
              id="conteudo"
              tabIndex={-1}
              className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 outline-none sm:px-6 md:pb-10"
            >
              <Outlet />
            </main>
          </div>
        </div>
        <BarraInferior />
      </SidebarProvider>
    </ProvedorEmpresa>
  );
}
