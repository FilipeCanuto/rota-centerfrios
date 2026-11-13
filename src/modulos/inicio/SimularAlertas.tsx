import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMascote } from "@/modulos/mascote/MascoteProvider";
import { mensagem, type ChaveMensagem } from "@/modulos/mascote/mensagens";
import { useSessao } from "@/modulos/sessao/sessao";

const OPCOES: { chave: ChaveMensagem; rotulo: string; n: number }[] = [
  { chave: "recompra_atrasada", rotulo: "Recompra atrasada", n: 3 },
  { chave: "orcamento_parado", rotulo: "Orçamento parado", n: 2 },
  { chave: "cliente_esquecido", rotulo: "Cliente esquecido", n: 4 },
  { chave: "meta_perto", rotulo: "Meta perto", n: 85 },
  { chave: "meta_batida", rotulo: "Meta batida", n: 1 },
];

/** Só para testar os balões: aparece para administrador e diretoria. Cada clique gera um balão novo. */
export function SimularAlertas() {
  const { data: sessao } = useSessao();
  const mascote = useMascote();
  const papeis = (sessao?.papeis ?? []) as string[];
  if (!papeis.includes("administrador") && !papeis.includes("diretoria")) return null;
  const apelido = sessao?.usuario?.apelido_copiloto ?? "Pinguim";
  return (
    <section aria-labelledby="simular-t" className="cartao p-4">
      <h2 id="simular-t" className="mb-1 flex items-center gap-2 text-base font-bold">
        <FlaskConical className="size-4" aria-hidden="true" /> Simular balões
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Teste como o pinguim avisa. Os balões aparecem um de cada vez e também vão para o sino.
      </p>
      <div className="flex flex-wrap gap-2">
        {OPCOES.map((o) => (
          <Button
            key={o.chave}
            variant="outline"
            className="min-h-11"
            onClick={() =>
              mascote.notificar(mensagem(o.chave, `simulacao:${o.chave}:${Date.now()}`, apelido, o.n))
            }
          >
            {o.rotulo}
          </Button>
        ))}
      </div>
    </section>
  );
}
