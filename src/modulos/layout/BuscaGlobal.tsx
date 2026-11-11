import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useEmpresasAtivas } from "@/modulos/sessao/sessao";
import { useBuscaClientes } from "./dados";
import { DESTINOS } from "./navegacao";

export function BuscaGlobal() {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  // Espera a pessoa parar de digitar para não fazer uma consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setTermo(texto), 250);
    return () => clearTimeout(t);
  }, [texto]);
  const busca = useBuscaClientes(termo, useEmpresasAtivas(), aberto);
  const clientes = busca.data ?? [];
  const telas = DESTINOS.filter((d) => d.titulo.toLowerCase().includes(texto.trim().toLowerCase()));

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAberto(true)}
        className="justify-start gap-2 text-muted-foreground sm:w-56"
        aria-label="Buscar (Ctrl+K)"
      >
        <Search aria-hidden="true" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="ml-auto hidden rounded border px-1.5 text-xs sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={aberto} onOpenChange={setAberto} shouldFilter={false}>
        <CommandInput
          value={texto}
          onValueChange={setTexto}
          placeholder="Buscar clientes ou telas…"
          aria-label="Buscar clientes ou telas"
        />
        <CommandList>
          {!busca.isError && telas.length === 0 && clientes.length === 0 && !busca.isFetching && (
            <p className="py-6 text-center text-sm">Nada encontrado.</p>
          )}
          <CommandGroup heading="Telas">
            {telas.map((d) => (
              <CommandItem
                key={d.url}
                onSelect={() => {
                  setAberto(false);
                  navigate({ to: d.url });
                }}
                className="min-h-11"
              >
                <d.icone aria-hidden="true" /> {d.titulo}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Clientes">
            {busca.isError && (
              <CommandItem onSelect={() => busca.refetch()} className="min-h-11 text-perigo">
                Não foi possível buscar clientes. Tentar de novo
              </CommandItem>
            )}
            {clientes.map((c) => (
              <CommandItem
                key={c.id}
                value={c.id}
                onSelect={() => {
                  setAberto(false);
                  navigate({ to: "/clientes/$id", params: { id: c.id } });
                }}
                className="min-h-11"
              >
                <span>{c.nome}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {c.segmento} · {c.cidade}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
