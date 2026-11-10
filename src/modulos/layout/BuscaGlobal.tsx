import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { DESTINOS } from "./navegacao";

export function BuscaGlobal() {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAberto((v) => !v); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  const { data: clientes } = useQuery({
    queryKey: ["busca-clientes"],
    enabled: aberto,
    queryFn: async () => (await supabase.from("clientes").select("id,nome,cidade,segmento").order("nome").limit(500)).data ?? [],
  });

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)} className="justify-start gap-2 text-muted-foreground sm:w-56" aria-label="Buscar (Ctrl+K)">
        <Search aria-hidden="true" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="ml-auto hidden rounded border px-1.5 text-xs sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={aberto} onOpenChange={setAberto}>
        <CommandInput placeholder="Buscar clientes ou telas…" aria-label="Buscar clientes ou telas" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Telas">
            {DESTINOS.map((d) => (
              <CommandItem key={d.url} onSelect={() => { setAberto(false); navigate({ to: d.url }); }} className="min-h-11">
                <d.icone aria-hidden="true" /> {d.titulo}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Clientes">
            {(clientes ?? []).map((c) => (
              <CommandItem key={c.id} value={`${c.nome} ${c.cidade ?? ""}`} onSelect={() => { setAberto(false); navigate({ to: "/clientes" }); }} className="min-h-11">
                <span>{c.nome}</span>
                <span className="ml-auto text-xs text-muted-foreground">{c.segmento} · {c.cidade}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
