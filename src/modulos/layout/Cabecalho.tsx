import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Monitor, Moon, Sun, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BotaoVoltar } from "@/design-system/BotaoVoltar";
import { Logo } from "@/design-system/Logo";
import { formatarPercentual } from "@/design-system/formatar";
import {
  definirIntensidade,
  INTENSIDADES,
  useIntensidade,
  type Intensidade,
} from "@/design-system/movimento";
import { useTema, type Tema } from "@/design-system/tema";
import { supabase } from "@/integrations/supabase/client";
import { useNotificacoes } from "@/modulos/notificacoes/dados";
import { podeVerAmbas, useEmpresa, useEmpresasAtivas, useSessao } from "@/modulos/sessao/sessao";
import { BuscaGlobal } from "./BuscaGlobal";
import { useCoberturaCabecalho } from "./dados";

export function Cabecalho() {
  const { data: sessao } = useSessao();
  const { empresa, definir } = useEmpresa();
  const ativas = useEmpresasAtivas();
  const { data: cobertura } = useCoberturaCabecalho(sessao?.usuario?.id, ativas);
  const { data: notificacoes } = useNotificacoes(sessao?.usuario?.id);
  const { tema, definirTema } = useTema();
  const intensidade = useIntensidade();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const caminho = useRouterState({ select: (r) => r.location.pathname });

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const naoLidas = (notificacoes ?? []).filter((n) => !n.lida_em);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        {caminho !== "/inicio" && <BotaoVoltar />}
        <SidebarTrigger
          className="hidden size-11 md:inline-flex"
          aria-label="Recolher ou expandir menu"
        />
        <Link
          to="/inicio"
          className="pressionar min-w-0 shrink rounded-md md:hidden"
          aria-label="Rota CENTERFRIOS — Início"
        >
          <Logo className="h-7" />
        </Link>

        {sessao && sessao.empresas.length > 1 && (
          <Select value={empresa} onValueChange={definir}>
            <SelectTrigger className="hidden min-h-11 w-auto min-w-40 sm:flex" aria-label="Empresa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sessao.empresas.map((e) => (
                <SelectItem key={e.id} value={e.id} className="min-h-11">
                  {e.nome}
                </SelectItem>
              ))}
              {podeVerAmbas(sessao.papeis) && (
                <SelectItem value="ambas" className="min-h-11">
                  Ambas as empresas
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <BuscaGlobal />
          {cobertura !== undefined && (
            <Link
              to="/inicio"
              hash="cobertura"
              className="pressionar inline-flex min-h-11 items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold sm:px-3"
              aria-label={`Cobertura da carteira: ${formatarPercentual(cobertura)}`}
            >
              <Users className="size-4 text-primary" aria-hidden="true" />
              <span className="numeros">{formatarPercentual(cobertura)}</span>
              <span className="hidden text-muted-foreground lg:inline">cobertura</span>
            </Link>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={`Notificações: ${naoLidas.length} não lidas`}
              >
                <Bell aria-hidden="true" />
                {naoLidas.length > 0 && (
                  <span
                    className="numeros absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-perigo px-1 text-[0.6875rem] font-bold text-destructive-foreground"
                    aria-hidden="true"
                  >
                    {naoLidas.length > 9 ? "9+" : naoLidas.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <h2 className="mb-2 font-display font-bold">Notificações</h2>
              {naoLidas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma notificação não lida.</p>
              ) : (
                <ul className="cascata max-h-80 space-y-2 overflow-y-auto text-sm">
                  {naoLidas.slice(0, 8).map((a) => (
                    <li key={a.id} className="border-b pb-2 last:border-0">
                      {a.titulo}
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="px-0">
                <Link to="/notificacoes">Ver todas as notificações</Link>
              </Button>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menu do usuário"
                className="rounded-full"
              >
                <span
                  className="grid size-9 place-items-center rounded-full bg-primary-suave font-display font-bold text-primary"
                  aria-hidden="true"
                >
                  {sessao?.usuario?.nome?.[0] ?? "?"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>{sessao?.usuario?.nome ?? "Usuário"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sessao && sessao.empresas.length > 1 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground sm:hidden">
                    Empresa
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={empresa}
                    onValueChange={definir}
                    className="sm:hidden"
                  >
                    {sessao.empresas.map((e) => (
                      <DropdownMenuRadioItem key={e.id} value={e.id} className="min-h-11">
                        {e.nome}
                      </DropdownMenuRadioItem>
                    ))}
                    {podeVerAmbas(sessao.papeis) && (
                      <DropdownMenuRadioItem value="ambas" className="min-h-11">
                        Ambas
                      </DropdownMenuRadioItem>
                    )}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator className="sm:hidden" />
                </>
              )}
              <DropdownMenuLabel className="text-xs text-muted-foreground">Tema</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={tema} onValueChange={(v) => definirTema(v as Tema)}>
                <DropdownMenuRadioItem value="claro" className="min-h-11">
                  <Sun className="mr-2 size-4" aria-hidden="true" />
                  Claro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="escuro" className="min-h-11">
                  <Moon className="mr-2 size-4" aria-hidden="true" />
                  Escuro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="auto" className="min-h-11">
                  <Monitor className="mr-2 size-4" aria-hidden="true" />
                  Automático
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Intensidade do movimento
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={intensidade}
                onValueChange={(v) => definirIntensidade(v as Intensidade)}
              >
                {INTENSIDADES.map((i) => (
                  <DropdownMenuRadioItem key={i.valor} value={i.valor} className="min-h-11">
                    {i.rotulo}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={sair} className="min-h-11">
                <LogOut className="mr-2 size-4" aria-hidden="true" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
