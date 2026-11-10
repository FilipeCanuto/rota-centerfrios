import { Outlet } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ProvedorEmpresa } from "@/modulos/sessao/sessao";
import { BarraInferior } from "./BarraInferior";
import { Cabecalho } from "./Cabecalho";
import { MenuLateral } from "./MenuLateral";

export function Estrutura() {
  return (
    <ProvedorEmpresa>
      <a href="#conteudo" className="pular-link">Pular para o conteúdo</a>
      <SidebarProvider>
        <div className="flex min-h-dvh w-full">
          <MenuLateral />
          <div className="flex min-w-0 flex-1 flex-col">
            <Cabecalho />
            <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 outline-none sm:px-6 md:pb-10">
              <Outlet />
            </main>
          </div>
        </div>
        <BarraInferior />
      </SidebarProvider>
    </ProvedorEmpresa>
  );
}
