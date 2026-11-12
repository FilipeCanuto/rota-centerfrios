import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/design-system/Logo";
import { Pinguim } from "@/design-system/Pinguim";
import { DESTINOS } from "./navegacao";

export function MenuLateral() {
  const { state } = useSidebar();
  const recolhido = state === "collapsed";
  const caminho = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon" className="hidden md:flex">
      <SidebarHeader className="h-16 justify-center px-3">
        {recolhido ? <Pinguim className="size-8 text-foreground" /> : <Logo className="h-9" />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Principal">
              <SidebarMenu>
                {DESTINOS.map((d) => {
                  const ativo = caminho.startsWith(d.url);
                  return (
                    <SidebarMenuItem key={d.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={ativo}
                        tooltip={d.titulo}
                        className="pressionar min-h-11 text-[0.9375rem]"
                      >
                        <Link to={d.url} aria-current={ativo ? "page" : undefined}>
                          <d.icone aria-hidden="true" />
                          <span>{d.titulo}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
