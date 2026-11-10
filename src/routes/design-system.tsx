import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EstadoVazio } from "@/design-system/EstadoVazio";
import { GraficoAnel } from "@/design-system/GraficoAnel";
import { Logo } from "@/design-system/Logo";
import { Pinguim } from "@/design-system/Pinguim";
import { Progresso } from "@/design-system/Progresso";
import { SeloStatus } from "@/design-system/SeloStatus";
import { Snowflake } from "lucide-react";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "Design system Polar — Rota CENTERFRIOS" },
      { name: "description", content: "Tokens, tipografia e componentes do design system Polar nos temas claro e escuro." },
      { property: "og:title", content: "Design system Polar — Rota CENTERFRIOS" },
      { property: "og:description", content: "Tokens, tipografia e componentes do design system Polar nos temas claro e escuro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignSystem,
});

const TOKENS = [
  ["Fundo", "bg-background"], ["Superfície", "bg-card"], ["Texto", "bg-foreground"], ["Texto secundário", "bg-muted-foreground"],
  ["Primária", "bg-primary"], ["Primária suave", "bg-primary-suave"], ["Ouro", "bg-ouro"], ["Borda de campo", "bg-campo"],
  ["Divisória", "bg-border"], ["Sucesso", "bg-sucesso"], ["Atenção", "bg-atencao"], ["Perigo", "bg-perigo"],
] as const;

function Painel({ escuro }: { escuro: boolean }) {
  return (
    <section aria-labelledby={escuro ? "t-escuro" : "t-claro"} className={`${escuro ? "dark" : ""}`}>
      <div className="flex flex-col gap-8 rounded-xl border bg-background p-5 text-foreground sm:p-8">
        <h2 id={escuro ? "t-escuro" : "t-claro"} className="text-2xl font-extrabold">Tema {escuro ? "escuro" : "claro"}</h2>

        <div>
          <h3 className="mb-3 font-bold">Cores</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {TOKENS.map(([nome, classe]) => (
              <li key={nome} className="flex items-center gap-3">
                <span className={`size-10 shrink-0 rounded-md border ${classe}`} aria-hidden="true" />
                <span className="text-sm"><strong className="block">{nome}</strong><code className="text-muted-foreground">{classe.replace("bg-", "--")}</code></span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="mb-3 font-bold">Tipografia</h3>
          <p className="font-display text-4xl font-extrabold">Plus Jakarta Sans — títulos</p>
          <p>Inter — texto de corpo em 16px, com leitura confortável e espaçamento generoso.</p>
          <p className="numeros text-2xl font-bold">R$ 1.234.567 · 98%</p>
        </div>

        <div>
          <h3 className="mb-3 font-bold">Botões</h3>
          <div className="flex flex-wrap gap-2">
            <Button>Primário</Button><Button variant="outline">Contorno</Button><Button variant="suave">Suave</Button>
            <Button variant="ghost">Fantasma</Button><Button variant="ouro">Conquista</Button><Button variant="destructive">Perigo</Button><Button variant="link">Link</Button>
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-bold">Status (ícone + palavra)</h3>
          <div className="flex flex-wrap gap-2">
            <SeloStatus tom="sucesso">Em dia</SeloStatus><SeloStatus tom="atencao">Atenção</SeloStatus>
            <SeloStatus tom="perigo">Urgente</SeloStatus><SeloStatus tom="info">Informação</SeloStatus><SeloStatus tom="conquista">Meta atingida</SeloStatus>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="cartao p-5">
            <h3 className="mb-3 font-bold">Campo de formulário</h3>
            <Label htmlFor={`campo-${escuro}`}>Nome do cliente</Label>
            <Input id={`campo-${escuro}`} className="mt-1.5 min-h-11" placeholder="Ex.: Padaria Pão Dourado" aria-describedby={`erro-${escuro}`} aria-invalid="true" />
            <p id={`erro-${escuro}`} className="mt-1.5 text-sm font-semibold text-perigo">Informe o nome do cliente.</p>
            <h3 className="mb-2 mt-6 font-bold">Progresso</h3>
            <div className="space-y-3"><Progresso valor={0.62} rotulo="Exemplo 62%" /><Progresso valor={1} rotulo="Exemplo atingido" /></div>
          </div>
          <div className="cartao p-5">
            <h3 className="mb-3 font-bold">Gráfico em anel</h3>
            <GraficoAnel valor={0.68} rotulo="Exemplo de meta" resumo="68% da meta atingidos." tabela={[{ indicador: "Meta", valor: "R$ 100.000" }, { indicador: "Faturado", valor: "R$ 68.000" }]} />
          </div>
        </div>

        <div className="cartao flex items-center gap-4 p-5">
          <Pinguim className="size-14 shrink-0 text-foreground" />
          <p className="font-display text-lg font-semibold">Beto aqui: 3 clientes precisam de você hoje.</p>
        </div>

        <EstadoVazio icone={Snowflake} titulo="Estado vazio">Telas ainda não construídas explicam o que vai aparecer ali.</EstadoVazio>
      </div>
    </section>
  );
}

function DesignSystem() {
  return (
    <main id="conteudo" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <Logo className="h-10" />
        <h1 className="text-3xl font-extrabold sm:text-4xl">Design system Polar</h1>
        <p className="max-w-2xl text-muted-foreground">Elegante e sóbrio: bordas finas, sombras quase nulas, cantos de 12px em cartões e 8px em botões. O ouro aparece só em conquistas.</p>
      </header>
      <Painel escuro={false} />
      <Painel escuro />
    </main>
  );
}
