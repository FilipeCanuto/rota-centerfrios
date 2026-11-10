import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAnunciar } from "@/design-system/Anunciador";
import { supabase } from "@/integrations/supabase/client";
import { formatarISO } from "@/regras";

const TIPOS = [
  { v: "whatsapp", r: "WhatsApp" },
  { v: "ligacao", r: "Ligação" },
  { v: "visita", r: "Visita" },
  { v: "outro", r: "Outro" },
] as const;
const RESULTADOS = ["Pedido fechado", "Orçamento solicitado", "Retornar depois", "Sem interesse"];

export interface ClienteContato { id: string; nome: string; empresa_id: string }

function Opcoes<T extends string>({ legenda, opcoes, valor, aoMudar }: { legenda: string; opcoes: { v: T; r: string }[]; valor: T | null; aoMudar: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{legenda}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {opcoes.map((o) => (
          <Button key={o.v} type="button" variant={valor === o.v ? "default" : "outline"} aria-pressed={valor === o.v} onClick={() => aoMudar(o.v)} className="whitespace-normal">
            {o.r}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

export function RegistrarContato({ cliente, vendedorId, aberto, aoFechar }: { cliente: ClienteContato | null; vendedorId: string; aberto: boolean; aoFechar: () => void }) {
  const qc = useQueryClient();
  const anunciar = useAnunciar();
  const id = useId();
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["v"] | null>(null);
  const [respondeu, setRespondeu] = useState<"sim" | "nao" | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [proximo, setProximo] = useState("");
  const [dataProx, setDataProx] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const limpar = () => { setTipo(null); setRespondeu(null); setResultado(null); setProximo(""); setDataProx(""); setErro(null); };

  async function salvar() {
    if (!cliente) return;
    if (!tipo || !respondeu) { setErro("Escolha o tipo de contato e se o cliente respondeu."); return; }
    if (proximo && !dataProx) { setErro("Informe a data do próximo passo."); return; }
    setErro(null); setSalvando(true);
    const { error } = await supabase.from("interacoes").insert({
      empresa_id: cliente.empresa_id, cliente_id: cliente.id, vendedor_id: vendedorId, tipo,
      cliente_respondeu: respondeu === "sim", resultado,
    });
    if (!error && proximo) {
      const r = await supabase.from("tarefas_agenda").insert({ empresa_id: cliente.empresa_id, cliente_id: cliente.id, vendedor_id: vendedorId, titulo: proximo, data: dataProx });
      if (r.error) { setSalvando(false); setErro("Contato salvo, mas não foi possível criar a tarefa."); return; }
    }
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar. Tente novamente."); return; }
    const msg = `Contato com ${cliente.nome} registrado${proximo ? " e próximo passo agendado" : ""}.`;
    toast.success(msg); anunciar(msg);
    qc.invalidateQueries({ queryKey: ["painel"] });
    limpar(); aoFechar();
  }

  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) { limpar(); aoFechar(); } }}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-2xl overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Registrar contato</SheetTitle>
          <SheetDescription>{cliente?.nome}</SheetDescription>
        </SheetHeader>
        <form className="mt-4 flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); salvar(); }} aria-describedby={erro ? `${id}-erro` : undefined}>
          <Opcoes legenda="Tipo de contato" opcoes={[...TIPOS]} valor={tipo} aoMudar={setTipo} />
          <Opcoes legenda="O cliente respondeu?" opcoes={[{ v: "sim", r: "Sim" }, { v: "nao", r: "Não" }]} valor={respondeu} aoMudar={setRespondeu} />
          <Opcoes legenda="Resultado (opcional)" opcoes={RESULTADOS.map((r) => ({ v: r, r }))} valor={resultado} aoMudar={(v) => setResultado(resultado === v ? null : v)} />
          <fieldset className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <legend className="mb-2 font-semibold">Próximo passo (opcional)</legend>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-prox`}>O que fazer</Label>
              <Input id={`${id}-prox`} className="min-h-11" value={proximo} onChange={(e) => setProximo(e.target.value)} placeholder="Ex.: enviar proposta" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-data`}>Quando</Label>
              <Input id={`${id}-data`} type="date" className="min-h-11" min={formatarISO(new Date())} value={dataProx} onChange={(e) => setDataProx(e.target.value)} />
            </div>
          </fieldset>
          {erro && <p id={`${id}-erro`} role="alert" className="font-semibold text-perigo">{erro}</p>}
          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => { limpar(); aoFechar(); }}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar contato"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
